"""One paragraph per worker. Parent enforces hard subprocess deadline."""
import sys,json,pathlib,subprocess
import soundfile as sf
import imageio_ffmpeg
from kokoro_onnx import Kokoro
from models import ensure_models,ROOT
ensure_models()
job=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
k=Kokoro(str(ROOT/'model.onnx'),str(ROOT/'voices.bin'))
audio,rate=k.create(job['text'],voice=job['voice'],speed=1.0,lang=job['lang'])
out=pathlib.Path(job['output']); wav=out.with_suffix('.wav'); sf.write(wav,audio,rate)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','64k',str(out)],check=True,timeout=30)
wav.unlink()
print(json.dumps({'duration':len(audio)/rate}))
