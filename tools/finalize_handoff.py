"""Bind the delivered A source to the student's actual Git commit.
Run after committing A's delivered files, before sending the handoff to AI B.
Only updates evidence placeholders in HANDOFF.md and T05_RESULT.md.
Never edits the plan, test inputs, expected values, or application source.
"""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
A_START='2b1612fa08ed60cd7d92174cd4fb3a3440c723fc'
TOKEN='A_END_COMMIT_PENDING'

def git(*args):
    proc=subprocess.run(['git',*args],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if proc.returncode:raise RuntimeError(proc.stderr.decode('utf-8',errors='replace'))
    return proc.stdout

def digest(content): return hashlib.sha256(content.replace(b'\r\n',b'\n')).hexdigest()

def main():
    if TOKEN not in (ROOT/'HANDOFF.md').read_text('utf-8'):
        print('Handoff already has an A source commit. No files changed.')
        return
    head=git('rev-parse','HEAD').decode().strip()
    if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})',head):raise RuntimeError('Not a full commit hash')
    git('merge-base','--is-ancestor',A_START,head)
    manifest=json.loads((ROOT/'evidence/AI_A_source_manifest.json').read_text('utf-8'))
    for entry in manifest['files']:
        name=entry['path']
        actual=digest(git('show',f'{head}:{name}'))
        working=digest((ROOT/name).read_bytes())
        if actual != entry['sha256_lf'] or working != entry['sha256_lf']:
            raise RuntimeError(f'{name}: commit or working tree differs from delivered AI A source. Apply and commit the exact source first.')
    source_paths=manifest['source_paths_for_diff']
    numstat=git('diff','--numstat',A_START,head,'--',*source_paths).decode('utf-8')
    added=deleted=0
    for row in numstat.splitlines():
        a,d,_=row.split('\t',2)
        if a.isdigit():added+=int(a)
        if d.isdigit():deleted+=int(d)
    for name in ['HANDOFF.md','T05_RESULT.md']:
        path=ROOT/name
        txt=path.read_text('utf-8')
        txt=txt.replace(TOKEN,head)
        txt=txt.replace('A_SOURCE_ADDED_PENDING',str(added)).replace('A_SOURCE_DELETED_PENDING',str(deleted))
        path.write_text(txt,'utf-8',newline='\n')
    print('A source commit:',head)
    print('Source diff: +',added,' -',deleted,sep='')
    print('Verified the committed source against the delivered normalized-LF SHA-256 manifest.')
    print('Updated HANDOFF.md and T05_RESULT.md. Commit these two docs separately; their target source commit stays the same.')
    print('No application, PLAN, tests, or Excel data was modified.')

if __name__=='__main__':
    try: main()
    except (OSError,RuntimeError,KeyError,json.JSONDecodeError) as exc:
        raise SystemExit(f'Handoff not finalized: {exc}')
