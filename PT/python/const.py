
MEDIAEXT = ['.mkv','.mp4','.avi','.rmvb','.rm','.mpg','.mpeg','.ts','.mov','.wmv','.m2ts']
# 有可能出现在论坛名、压制组中的文件属性关键字，避免混淆识别，如：压制组BT4K 中的4K容易被识别为reslution字段
GROUPNAMESEG = ('4K','BD','HD','UHD','MP4','HDR','MKV','DC','SE','3D')
# 有可能出现在论坛名、压制组中的结尾，用于识别，提供给group字段
GROUPNAMEEND = '压制组|字幕组|原创组|小组|出品|论坛|龙网|HD'

# |亿万同人字幕组|橘里橘气译制组|悸花字幕组|小易甫字幕组|马特鲁字幕组|弯弯字幕组
preparePatterns = {'ZMZ\-.*\-MP4|mUHD\-FRDS|FFansBD|邵氏|mp4ba|自由译者联盟':('group','re!!!'),
                '(?:[\[〖『「《【]?[a-zA-Z&\u4e00-\u9fa5]+(?:译制组|压制组|字幕组|原创组|小组|出品|论坛|龙网)[\]】〗』」》·]?)':('group','re!!!'),
                '(?:(?:默认)?[国英葡法俄日韩德意西印泰台港粤中导]{1,10}(?:[双三四五六]语(?!字幕)|[双三四五六]音轨|语配音|语音频|语.字)|[国英葡法俄日韩德意西印泰台港粤中导]{3,10})':('audioLang','re!!!'),
                '(?:(?:特效|内封|官译|官方|外挂|默认|(?:[国英葡法俄日韩德意西印泰台港粤中简繁语体文字]+)){1,3}(?:[双三四五六]字|字幕|双语字幕)|简体中字|中字简体|中字|双语字幕|(?:特效|内封|官译|外挂)+[国英葡法俄日韩德意西印泰台港粤中简繁语文字]+)|(?:[国英葡法俄日韩德意西印泰台港粤中简繁语文字]+(?:特效|内封|官译|外挂)+)':('subLang','re!!!'),
                'BD\-MP4|WEB\-MP4':('excess',''),
                'pniao.com':('website','re!!!'),
                '蓝光':('source','re!!!'),
}

# patterns编写原则：
# 受 \b 拼接影响的正则，所以必须要以(?:)为外壳，并保持壳内不成group
# 'season', 'episode','cd' 等会同时匹配 raw，clean 修改时需要保持这个规则
# (?:MP3|DDP?5\.?1|AAC[.-]LC|AAC(?:\.?2\.0)?|(?:AC3|DD)(?:.?[52]\.[10])?|PCM|LPCM|FLAC|DTS(?:-(?:X|HD))?[\.\s\-]?(?:MA|HRA|ES)?(?:[\.\s\-]?[76521]\.[10])?|Atmos|TrueHD(?:\.[76521]\.[10])?)
# 原版group范围更小，少误伤 (?:- ?(?:[^-]+(?:-={[^-]+-?$)?))$|(?:(?:^|[\[〖『「《【]).+(?:译制组|压制组|字幕组|原创组|小组|出品|论坛|龙网|HD)\s?[\]】〗』」》·])|\b(?:.+(?:译制组|压制组|字幕组|原创组|小组|出品|)\b)
# GER|MAN  → german

patterns = [
    ('resolution', '([0-9]{3,4}[pi]|4k|[0-9]{3,4}[xX][0-9]{3,4}p?)'),
    ('year', '([\[\(]?((?:19[0-9]|20[0-9])[0-9])[\]\)]?)'),
    ('season', '(s?([0-9]{1,2}))[ex](?=[\d+])'),
    ('episode', '((?<=[0-9])[ex]p?([0-9]{2})(?:[^0-9]|$))'),
    ('source', '(?:(?:PPV\.)?(?:HR[-])?[HP]DTV(?:Rip|\-HR)?|VOD|(?:HD)?CAM|(?:PPV )?WEB-?DL(?: DVDRip)?|(?:Cam|WEB|TV|B[DR]|F?HD|(?:HQ)?DVD)-?(?:Rip|HR)|Blu.?Ray|DvDScr|telesync|UHD|UltraHD|(?:BD)?Remux)'),
    ('codec', '(?:mpeg2|vc\-1|hevc|avc|xvid|[hx]\.?26[45])'),
    ('audio', '(?:MP3|AAC[.-]LC|(?:DD[P\+]?|A?AC|AC3|DD|PCM|LPCM|FLAC|DTS(?:(?:[-\s]X|[-\s]HD))?(?:[\.\s\-]{0,2}(?:M.?A|HRA|ES))?|TrueHD|Atmos)(?:[\.\s\-]{0,2}[76521][\.\s][10])?)'),
    ('dynRes','(?:SDR|HDR10Plus|HDR\-X|HDR|HLG|DV|DoVi|Dolby.Vision)'),
    ('region', 'R[0-9]'),
    ('release', '(?:(?:(?:The.)?(?:Special|Collector\'?s|Ultimate|Final|Limited|Director\\\\{0,2}\'?s|REMASTERED|EXTENDED|UNCUT|UNRATED|THEATRICAL|PROPER|SUBBED|ENSUBBED|IMAX|REPACK)+(?:.(?:Cut|Edition|Version)))|(?:(?:The.)?(?:REMASTERED|EXTENDED|UNCUT|UNRATED|THEATRICAL|PROPER|SUBBED|ENSUBBED|IMAX|REPACK|(?:[0-9]{2}TH.)?ANNIVERSARY)+(?:Collector\'?s)?(?:.(?:Cut|Edition|Version))?)|(?:GBR|HKG|CEE|EUR|USA|AUS|V2|Carlotta|RERip|Criterion.Collection|Criterion|Open.Matte|Masters.of.Cinema))'),
    ('stream', '(?:hbo.max|HMAX|NF|Netflix|AMZN|HULU|DSNP|iP)'),
    ('size', '(\d+(?:\.\d+)?(?:GB|MB))'),
    ('3d', '3D'),
    ('audioLangNum','(([0-9])Audios?|(?:Dual|Tri|Quad|Multi)[\- \.]?Audio)'),
    ('audioLang', '(?:(?:English|Russian|Portuguese|Spanish|French|German|Italian|Dutch|Turkish|Japanese|Korean|Thai|Vietnamese|Arabic|Polish|Mandarin|Cantonese|Chinese|INDONESIAN)[\.\-\s&_]?){2,}'),
    ('subLang', '(?:(?:GER|ENG|CHS|CHI|FRA|FRE|DEU|KOR|ITA|JPN|ARA|RUS|CHT|THA|PLK|POR|SPA|FRE|JAP|CAN)[\.\-\s&_]?){2,}|(?:(?:GB|JP)[\.\-\s&_]?){2,}'),
    ('fps', '(?:([0-9]{2})(?:fps|帧))'),
    ('bit', '((1?[0-9])bits?)'),
    ('cd','(?:cd([0-9]{1,2}))'),
    ('website', '([\[〖『「《【] ?(.+?\.(net|com|cn|org|info|de|tk|uk|ru|nl|xyz|eu|br|fr|au|it|us|ca|co|pl|es|in|cc|se|cd|be|site|jp|to|me|club|cf|vip|app|tv|dev|fan)) ?[\]】〗』」》@])'),# 修改版可能有未知错误，原版^(\[ ?([a-zA-Z0-9\.\s]+?) ?\])  在最前面 [720pMkv.Com] 和 [X战警.逆转未来.加长版] 区分
    ('group', '(?:(?:- ?(?:[^-]+(?:-={[^-]+-?$)?))$)')
]

recyclePatterns = {'翡翠台|CCTV[0-9]{1,2}':('source','HDTV'),
                '([0-9]{3,4}[pi])':('resolution','re!!!'),
                '720':('resolution','re!!!p'),
                r'(?:(?:BD|HD)(?=[0-9]{3,4}[pi]))|(?:[^\b]DVD)|(?:DVD[$\b])':('source','re!!!Rip'),
                '(?:ENGLISH|RUSSIAN|PORTUGUESE|SPANISH|FRENCH|DANiSH|GERMAN|ITALIAN|DUTCH|TURKISH|JAPANESE|KOREAN|THAI|VIETNAMESE|ARABIC|POLISH|MANDARIN|CANTONESE|CHINESE|INDONESIAN)':('audioLang','re!!!'),
                r'\b(?:GER|ENG|CHS|CHI|FRA|FRE|DEU|KOR|ITA|JPN|ARA|RUS|CHT|THA|PLK|POR|SPA|FRE|JAP)\b':('subLang','re!!!'),
                '(?:LiMiTED|LIMITED|iNTERNAL|INTERNAL|MULTi)':('release','re!!!!'),
                r'\b(?:BD|HD|WEB)\b':('source','re!!!Rip'),
                '(?:SDR|HDR10Plus|HDR\-X|HDR|DoVi)':('dynRes','re!!!'),
                r'\b(?:DC|SE|EE|CC)\b':('release','re!!!')
                
                }

# 中文关键字转换

types = {
    'season': 'integer',
    'episode': 'integer',
    'year': 'integer',
    'audioLangNum':'integer',
    'cd':'integer',
    '3d': 'boolean',
    'fps': 'integer',
    'bit': 'integer',
    'source':'list',
    'audio':'list',
    'release':'list',
    'audioLang':'list',
    'subLang':'list'
}
