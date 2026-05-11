import PyPDF2
reader = PyPDF2.PdfReader(r'f:\google agent\参考文件\新版“两制”平台参建单位用户操作手册.pdf')
open('liangzhi_text.txt', 'w', encoding='utf-8').write('\n'.join([page.extract_text() for page in reader.pages]))
