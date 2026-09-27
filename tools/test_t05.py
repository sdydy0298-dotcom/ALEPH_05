"""Run the unchanged ten PLAN cases through Chromium. No live network data is used.
Normal: python tools/test_t05.py
Restricted browser environment: python tools/test_t05.py --offline-dom --browser /usr/bin/chromium
Dependencies: pip install playwright ; python -m playwright install chromium
Each completed run is appended to evidence/t05-runs.json (never erased).
"""
from __future__ import annotations
import argparse
import functools
import hashlib
import http.server
import json
import math
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
PLAN_HASH = '6ab8d5b4eeb7f4adabcf12b1ffe3ea7f79a14e8b805d1a7e4cc646750919e365'
RATES = {'USD': 1/1400, 'JPY': 100/930, 'EUR': 1/1600, 'GBP': 1/1900}
RATE_BODY = {'result':'success','base_code':'KRW','time_last_update_unix':1790463600,'rates':RATES}

def plan_cases():
    raw = (ROOT/'T05_EXPERIMENT_PLAN.md').read_bytes().replace(b'\r\n',b'\n')
    if hashlib.sha256(raw).hexdigest() != PLAN_HASH:
        raise RuntimeError('Frozen plan differs from A start. Restore the original; do not update the expected hash.')
    cases = []
    for line in raw.decode('utf-8').splitlines():
        if re.match(r'\| TEST-\d{2} \|', line):
            fields = [x.strip() for x in line.strip('|').split('|')]
            cases.append(dict(zip(['id','description','input','expected'],fields)))
    assert len(cases)==10 and [x['id'] for x in cases] == [f'TEST-{n:02d}' for n in range(1,11)]
    return cases

def history_body(url):
    code = parse_qs(urlparse(url).query).get('base',['USD'])[0]
    return [{'base':code,'quote':'KRW','date':f'2026-09-{d:02d}','rate':1/RATES.get(code,RATES['USD'])+(d-20)*.001} for d in range(20,27)]

def bootstrap(page, offline):
    if not offline:
        return
    html = (ROOT/'index.html').read_text('utf-8')
    html = re.sub(r'<link[^>]+>', '', html)
    html = re.sub(r'<script[^>]*src="script.js"[^>]*></script>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT/'style.css').read_text('utf-8'))
    files = {str(f.relative_to(ROOT)).replace('\\','/'): f.read_text('utf-8') for f in (ROOT/'assets').rglob('*') if f.is_file()}
    page.expose_function('offlineSha256',lambda data: list(hashlib.sha256(bytes(data)).digest()))
    page.evaluate('''({files,rateBody}) => {
      const storage = new Map();
      Object.defineProperty(window,'localStorage',{value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),clear:()=>storage.clear()}});
      Object.defineProperty(crypto,'subtle',{value:{digest:async(_,data)=>new Uint8Array(await offlineSha256(Array.from(new Uint8Array(data)))).buffer}});
      window.__rateBody = rateBody;
      window.__failRates = false;
      window.fetch = async input => {
        const url=String(input);
        if(url.includes('open.er-api.com')) {
          if(window.__failRates)throw new TypeError('Simulated offline');
          return new Response(JSON.stringify(window.__rateBody));
        }
        if(url.includes('api.frankfurter.dev')) {
          const code = new URL(url).searchParams.get('base') || 'USD';
          const rows=Array.from({length:7},(_,i)=>({date:`2026-09-${20+i}`,base:code,quote:'KRW',rate:1/rateBody.rates[code]+i*.001}));
          return new Response(JSON.stringify(rows));
        }
        if(url in files)return new Response(files[url]);
        return new Response('Not found',{status:404});
      };
    }''', {'files':files,'rateBody':RATE_BODY})
    page.add_script_tag(content=(ROOT/'script.js').read_text('utf-8'))
    page.evaluate('init()')

def launch_browser(p, args):
    kw = {'headless':True}
    if args.browser: kw['executable_path']=args.browser
    return p.chromium.launch(**kw)


def run():
    ap=argparse.ArgumentParser()
    ap.add_argument('--offline-dom',action='store_true',help='In-memory DOM/storage/fetch adapters; does not test HTTP serving or real storage persistence.')
    ap.add_argument('--browser',help='Optional Chromium executable path')
    ap.add_argument('--actor',choices=['AI_A','AI_B'],default='AI_A')
    args=ap.parse_args()
    from playwright.sync_api import sync_playwright
    cases=plan_cases()
    evidence=ROOT/'evidence'; evidence.mkdir(exist_ok=True)
    server=None
    if not args.offline_dom:
        handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
    mode='offline-dom: real DOM + original JS; mocked fetch/localStorage/WebCrypto adapter' if args.offline_dom else 'http-server: real DOM + original JS + native storage; mocked external API responses'
    started=datetime.now(timezone.utc).isoformat()
    results=[]; supplemental=[]; errors=[]
    with sync_playwright() as p:
        browser=launch_browser(p,args)
        version=browser.version
        page=browser.new_page(viewport={'width':1440,'height':1100})
        page.set_default_timeout(8000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        if args.offline_dom:
            bootstrap(page,True)
        else:
            page.route('https://open.er-api.com/**',lambda r:r.fulfill(json=RATE_BODY))
            page.route('https://api.frankfurter.dev/**',lambda r:r.fulfill(json=history_body(r.request.url)))
            page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
        page.wait_for_function("document.getElementById('travelAppliedRate').textContent.includes('930')")
        def text(id): return page.locator('#'+id).inner_text()
        def fill(id,value): page.locator('#'+id).fill(str(value))
        def reset():
            page.locator('#travelForm button[type=reset]').click()
            page.wait_for_function("document.getElementById('travelBudget').value==='' && document.getElementById('travelReceived').textContent==='\u2014'")
        def valid():
            reset();fill('travelBudget',1500000)
        def check(ok,message):
            if not ok:raise AssertionError(message)
        def empty_result():
            return all(text(x)=='\u2014' for x in ['travelReceived','travelExchange','travelCharge','travelNet'])
        def invalid():
            return page.locator('#travelError').is_visible() and empty_result()
        for case in cases:
            result=dict(case)
            before=time.perf_counter()
            try:
                n=int(case['id'][-2:]); observed=''
                if n==1:
                    reset()
                    pairs={'JP':('JPY','100 JPY = 930 KRW'),'US':('USD','1 USD = 1,400 KRW'),'FR':('EUR','1 EUR = 1,600 KRW'),'DE':('EUR','1 EUR = 1,600 KRW'),'ES':('EUR','1 EUR = 1,600 KRW'),'GB':('GBP','1 GBP = 1,900 KRW')}
                    for country,(code,rate) in pairs.items():
                        page.select_option('#travelCountry',country)
                        check(text('travelCurrency')==code, country+' currency mismatch')
                        check(text('travelAppliedRate')==rate, country+' rate mismatch: '+text('travelAppliedRate'))
                    observed='JP/US/FR/DE/ES/GB mapped to JPY/USD/EUR/EUR/EUR/GBP with the matching fixed rates.'
                elif n==2:
                    valid();page.locator('#travelForm button[type=submit]').click()
                    check(not page.locator('#travelError').is_visible(),'Unexpected error')
                    check(not empty_result(),'Missing result')
                    observed=text('travelReceived')
                elif n==3:
                    valid();check(text('travelExchange')=='1,050,000 KRW',text('travelExchange'));observed=text('travelExchange')
                elif n==4:
                    valid();check(text('travelCharge')=='15,750 KRW',text('travelCharge'));observed=text('travelCharge')
                elif n==5:
                    valid();check(text('travelNet')=='1,034,250 KRW',text('travelNet'));observed=text('travelNet')
                elif n==6:
                    valid();check(text('travelReceived')=='111,209 JPY',text('travelReceived'))
                    check(text('travelAppliedRate')=='100 JPY = 930 KRW','Wrong fixed input')
                    observed=text('travelReceived')+' (unrounded: '+page.locator('#travelReceived').get_attribute('data-value')+')'
                elif n==7:
                    valid();first=text('travelReceived');page.select_option('#travelCountry','US')
                    check(text('travelReceived')=='738.75 USD',text('travelReceived'))
                    check(text('travelAppliedRate')=='1 USD = 1,400 KRW','Rate not changed')
                    observed=first+' -> '+text('travelReceived')
                elif n==8:
                    for value in ['0','-1','abc']:
                        valid();fill('travelBudget',value)
                        check(invalid(),'Invalid budget accepted: '+value)
                    observed='0 / -1 / abc: error visible, all previous result amounts cleared.'
                elif n==9:
                    for value in ['-1','101']:
                        valid();fill('travelRatio',value)
                        check(invalid(),'Invalid ratio accepted: '+value)
                    observed='-1 / 101: error visible, all previous result amounts cleared.'
                elif n==10:
                    reset()
                    initial=page.evaluate("[...document.querySelectorAll('#travelForm input,#travelForm select')].map(e=>e.value)")
                    fill('travelBudget',2000000);fill('travelRatio',50);fill('travelFee',2);page.select_option('#travelCountry','US')
                    check(not empty_result(),'No calculated state before reset')
                    reset()
                    after=page.evaluate("[...document.querySelectorAll('#travelForm input,#travelForm select')].map(e=>e.value)")
                    check(initial==after and empty_result(),'Reset mismatch')
                    check(not page.locator('#travelError').is_visible(),'Error not reset')
                    observed='Initial form state restored: '+json.dumps(after)+'; results cleared; no error.'
                result.update(status='PASS',observed=observed)
            except Exception as e:
                result.update(status='FAIL',observed=str(e))
            result['duration_ms']=round((time.perf_counter()-before)*1000)
            results.append(result)
            print(case['id'],result['status'],result['observed'],flush=True)
            (evidence / 't05-current-run.json').write_text(json.dumps({'actor':args.actor,'started_at':started,'mode':mode,'partial':True,'fixed_cases':results},ensure_ascii=False,indent=2),'utf-8')
        # Supplemental checks are separate; they never replace or alter a fixed case.
        def extra(name,fn):
            try:fn();supplemental.append({'check':name,'status':'PASS'})
            except Exception as e:supplemental.append({'check':name,'status':'FAIL','observed':str(e)})
        def fee_check():
            for value in ['-1','101','abc','']:
                valid();fill('travelFee',value);check(invalid(),'Invalid fee '+value)
            valid();fill('travelFee','0');check(text('travelCharge')=='0 KRW','Zero fee')
            fill('travelFee','100');check(text('travelReceived')=='0 JPY','100% fee')
        extra('Fee invalid input and 0/100 boundaries',fee_check)
        def numbers():
            valid();fill('travelBudget','1,500,000');check(text('travelReceived')=='111,209 JPY','Grouped amount')
            for value in ['', '   ', '1,00', 'NaN', 'Infinity', '1e999', '9007199254740992']:
                fill('travelBudget',value);check(invalid(),'Invalid number '+repr(value))
            valid();fill('travelRatio',0);check(text('travelExchange')=='0 KRW','0%')
            fill('travelRatio',100);check(text('travelExchange')=='1,500,000 KRW','100%')
        extra('Budget malformed/overflow and ratio 0/100 boundaries',numbers)
        def quick():
            fill('fromAmount',1000000)
            page.select_option('#fromCurrency','KRW');page.select_option('#toCurrency','JPY')
            check('107,527' in text('toAmount'),text('toAmount'))
            page.locator('#swapBtn').click();check(page.locator('#fromCurrency').input_value()=='JPY','Swap')
            page.locator('[data-currency=EUR]').click();check(text('trendTitle')=='EUR / KRW','Rate cards')
        extra('Original quick converter, swap and currency card',quick)
        def integrity():
            page.wait_for_function("document.getElementById('fixtureIntegrity').textContent.startsWith('VERIFIED')",timeout=15000)
        extra('Original T04 browser asset integrity',integrity)
        def fixture():
            page.locator('.test-lab summary').click()
            page.locator('#fixtureResetBtn').click()
            page.locator('[data-sequence=normal]').click()
            page.wait_for_function('state.fixtureState.daily_readings.length===2')
            before=page.evaluate("localStorage.getItem('rateflow.dailySnapshots.v3')")
            page.locator('#fixtureResetBtn').click()
            after=page.evaluate("localStorage.getItem('rateflow.dailySnapshots.v3')")
            check(before==after,'Reset altered live storage')
            page.locator('.test-lab summary').click()
        extra('T04 normal fixture sequence and reset isolation',fixture)
        if args.offline_dom:
            def offline():
                valid();page.evaluate('window.__failRates=true');page.locator('#refreshBtn').click()
                page.wait_for_function("state.status==='stale'")
                check(text('travelReceived')=='111,209 JPY','Last good amount lost')
                check('\ub9c8\uc9c0\ub9c9' in text('travelRateStatus'),'Stale warning missing')
                page.evaluate('window.__failRates=false');page.locator('#refreshBtn').click()
                page.wait_for_function("state.status==='fresh'")
            extra('Refresh failure keeps a labeled last-good planner rate',offline)
        def screenshot_sizes():
            valid();page.locator('#travelBudget').blur()
            for width,height in [(1920,1080),(1366,768),(768,1024),(390,844),(320,740)]:
                page.set_viewport_size({'width':width,'height':height})
                check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),str(width)+' horizontal overflow')
                box=page.locator('#travelPlanner').bounding_box()
                check(box['width']<=width,str(width)+' planner overflow')
                page.locator('#travelPlanner').screenshot(path=str(evidence/f'{args.actor}-planner-{width}.png'))
            page.set_viewport_size({'width':1366,'height':768})
            fill('travelRatio',101)
            page.locator('#travelPlanner').screenshot(path=str(evidence/f'{args.actor}-invalid-input.png'))
            valid();page.locator('#travelBudget').blur()
        extra('Responsive 1920/1366/768/390/320 and error-state screenshots',screenshot_sizes)
        extra('No uncaught browser JavaScript errors',lambda:check(not errors,str(errors)))
        browser.close()
    if server:server.shutdown()
    rec={'actor':args.actor,'started_at':started,'ended_at':datetime.now(timezone.utc).isoformat(),'browser':'Chromium '+version,'mode':mode,'plan_sha256_normalized_lf':PLAN_HASH,'fixture_rates':RATES,'fixed_cases':results,'passed':sum(r['status']=='PASS' for r in results),'failed':sum(r['status']=='FAIL' for r in results),'error_round':any(r['status']=='FAIL' for r in results),'supplemental':supplemental,'console_errors':errors,'limitations':['Fixed-rate simulation, not actual bank quotes or production deployment verification.']}
    path=evidence/'t05-runs.json'
    existing=json.loads(path.read_text('utf-8')) if path.exists() else []
    existing.append(rec)
    path.write_text(json.dumps(existing,ensure_ascii=False,indent=2),'utf-8')
    print(json.dumps({k:rec[k] for k in ['passed','failed','error_round','supplemental']},ensure_ascii=False,indent=2))
    return 0 if rec['failed']==0 else 1

if __name__=='__main__': raise SystemExit(run())
