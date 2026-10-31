"""Bounded, atomic article publication. No manifest until both voices succeed."""
import argparse,hashlib,json,pathlib,subprocess,sys,time,tempfile,shutil,re,os,signal
VOICES=[('af_heart','us','American English','en-us'),('bf_emma','uk','British English','en-gb')]
def positive(value):
    n=int(value)
    if n<=0: raise argparse.ArgumentTypeError('must be positive')
    return n
def generate(articles,root,max_articles=2,max_seconds=600,max_bytes=200_000_000,runner=None):
    root=pathlib.Path(root); root.mkdir(parents=True,exist_ok=True)
    used=sum(p.stat().st_size for p in root.rglob('*') if p.is_file())
    start=time.monotonic(); completed=0; attempted=0; report=[]
    def run(job,timeout):
        jobfile=pathlib.Path(job['output']).with_suffix('.json');jobfile.write_text(json.dumps(job),encoding='utf-8')
        command=[sys.executable,str(pathlib.Path(__file__).with_name('worker.py')),str(jobfile)]
        process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=os.name!='nt')
        try: stdout,stderr=process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            if os.name=='nt': subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True,timeout=10)
            else: os.killpg(process.pid,signal.SIGKILL)
            process.communicate(timeout=10)
            raise TimeoutError(f'paragraph worker exceeded {timeout:.2f}s')
        if process.returncode: raise RuntimeError(stderr[-1500:])
        jobfile.unlink();return json.loads(stdout.splitlines()[-1])
    runner=runner or run
    for a in articles:
        assert re.fullmatch(r'[\w-]+',a['articleId']), 'unsafe article id'
        assert re.fullmatch(r'[a-f0-9]{64}',a['contentVersion']), 'unsafe version'
        canonical=json.dumps({'schemaVer':2,'articleId':a['articleId'],'paragraphs':a['paragraphs']},ensure_ascii=False,separators=(',',':'))
        assert hashlib.sha256(canonical.encode('utf-8')).hexdigest()==a['contentVersion'], 'content version mismatch'
        assert a['paragraphs'] and all(isinstance(t,str) and t.strip() for t in a['paragraphs']), 'empty paragraph'
        destination=root/a['articleId']/a['contentVersion']
        if (destination/'manifest.json').exists(): continue
        if attempted>=max_articles or time.monotonic()-start>=max_seconds: break
        if used>=max_bytes: report.append({'articleId':a['articleId'],'missing':'audio budget exhausted'});break
        attempted+=1
        # Stage outside the public tree but on the destination filesystem.
        # One directory rename publishes segments and manifest together.
        staging_parent=root.resolve().parents[2] if root.parts[-3:]==('public','reading','audio') else root.resolve().parent
        temporary=pathlib.Path(tempfile.mkdtemp(prefix='.speech-',dir=staging_parent))
        try:
            voices=[]; size=0
            for voice,accent,label,lang in VOICES:
                segments=[];(temporary/voice).mkdir()
                for i,text in enumerate(a['paragraphs']):
                    remaining=max_seconds-(time.monotonic()-start)
                    if remaining<=0: raise TimeoutError('generation time budget exhausted')
                    path=f'{voice}/{i:04d}.mp3'; target=temporary/path
                    metadata=runner({'text':text,'voice':voice,'lang':lang,'output':str(target)},min(remaining,120))
                    data=target.read_bytes(); assert len(data)>0
                    size+=len(data)
                    if used+size>max_bytes: raise ValueError('audio byte budget exhausted')
                    segments.append({'index':i,'path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),**metadata})
                voices.append({'id':voice,'accent':accent,'label':label,'segments':segments})
            manifest={'schemaVer':1,'articleId':a['articleId'],'contentVersion':a['contentVersion'],'engine':'kokoro-onnx','voices':voices}
            manifest_text=json.dumps(manifest)
            size+=len(manifest_text.encode('utf-8'))
            if used+size>max_bytes: raise ValueError('audio byte budget exhausted including manifest')
            (temporary/'manifest.json').write_text(manifest_text,encoding='utf-8')
            destination.parent.mkdir(parents=True,exist_ok=True)
            if destination.exists(): raise ValueError('incomplete immutable destination; manual inspection required')
            temporary.rename(destination)
            used+=size; completed+=1
            print(json.dumps({'articleId':a['articleId'],'published':True,'bytes':size,'elapsed':time.monotonic()-start}),flush=True)
            report.append({'articleId':a['articleId'],'published':True})
        except Exception as e:
            report.append({'articleId':a['articleId'],'missing':str(e)})
            print(json.dumps(report[-1]),flush=True)
        finally:
            if temporary.exists(): shutil.rmtree(temporary)
    return {'completed':completed,'elapsed':time.monotonic()-start,'results':report}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',default='artifacts/speech-input.json');p.add_argument('--out',default='apps/web/public/reading/audio');p.add_argument('--max-articles',type=positive,default=2);p.add_argument('--max-seconds',type=positive,default=600);p.add_argument('--max-bytes',type=positive,default=200_000_000)
    a=p.parse_args();result=generate(json.loads(pathlib.Path(a.input).read_text(encoding='utf-8')),a.out,a.max_articles,a.max_seconds,a.max_bytes);print(json.dumps(result))
