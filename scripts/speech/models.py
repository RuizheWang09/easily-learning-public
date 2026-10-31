import hashlib,json,pathlib,urllib.request
ROOT=pathlib.Path('artifacts/speech-tools/models')
FILES=[('model.onnx','kokoro-v1.0.int8.onnx','6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb'),('voices.bin','voices-v1.0.bin','bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d')]
def ensure_models():
    ROOT.mkdir(parents=True,exist_ok=True)
    for local,remote,digest in FILES:
        target=ROOT/local
        if not target.exists():
            temporary=target.with_suffix('.download')
            with urllib.request.urlopen('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'+remote,timeout=60) as r,temporary.open('wb') as w:
                while block:=r.read(1024*1024): w.write(block)
            assert hashlib.sha256(temporary.read_bytes()).hexdigest()==digest,'Model SHA256 mismatch'
            temporary.replace(target)
        assert hashlib.sha256(target.read_bytes()).hexdigest()==digest,'Model SHA256 mismatch'
if __name__=='__main__': ensure_models()
