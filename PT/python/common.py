import os
import re
from const import patterns, types, recyclePatterns,preparePatterns,GROUPNAMESEG,GROUPNAMEEND,MEDIAEXT


class PTN(object):
    def _escape_regex(self, string):
        # 清理一下特殊字符
        return re.sub('[\-\[\]{}()*+?.,\\\^$|#\s]', '\\$&', string)

    def __init__(self):
        self.torrent = None
        self.excess_raw = None
        self.group_raw = None
        self.start = None
        self.end = None
        self.title_raw = None
        self.parts = None

    def _splitStrBorder(self,str):
        '''
        查找最长的两个单词的分界
        input:str
        return:zhPart,enPart
        '''
        # 清除干扰词
        clean = str
        for rpattern,fv in recyclePatterns.items():
            field,value = fv
            if field in ('audioLang','subLang'):
                continue
            match = re.findall(rpattern, clean, re.I)  
            if len(match) == 0: # 匹配不到就继续下一个类目
                continue
            if isinstance(match[0], tuple):
                if len(match) > 1:
                    tmpMatch = []
                    for x in match:
                        tmpMatch.append(sorted(x,key = lambda i:len(i))[-1])
                    match = tmpMatch
                else:
                    match = list(match[0])
                    match = [i for i in match if i != '']
            match = match[0]
            
            # 用 re!!! 作为标记
            if value.find('re!!!') != -1:
                value = value.replace('re!!!',match)

            # 从回收字段中清除匹配到的回收内容
            clean = self._strip(clean.replace(match,''))

        specSymbol = '\s\-！：〖『「《【】〗』」》·'
        zhPhrases = sorted(re.findall(u'[0-9\u4e00-\u9fa5\(\)%s]+'%specSymbol,clean),key = lambda i:len(i))
        zhPhrases = [i for i in zhPhrases if not re.sub('[%s]'%specSymbol,'',i).isdigit()]

        if zhPhrases:
            zhMaxPhrase = zhPhrases[-1].strip()
        enPhrases = sorted(re.findall(u'[a-zA-Z0-9\u00a0-\u00ff\u2160-\u217b\\\\\s\-！·]+',clean),key = lambda i:len(i))
        if enPhrases:
            enMaxPhrase = enPhrases[-1].strip()
            # 避免识别到只有中文且中文里面的碎片英文，规则：4个英文/数字字符，总字数大于9，且必须有中文
            if len(enMaxPhrase)<5 and len(str)>9 and zhPhrases:
                enMaxPhrase = '' 
        if zhPhrases and enPhrases:
            indexStartZhMax = str.find(zhMaxPhrase)
            indexEndZhMax = indexStartZhMax+len(zhMaxPhrase)
            indexStartEnMax = str.find(enMaxPhrase)
            indexEndEnMax = indexStartEnMax+len(enMaxPhrase)
            # 判断中文英文前后
            if indexStartZhMax < indexStartEnMax:
                zhFront = True
                splitIndex = indexStartEnMax
            else:
                zhFront = False
                splitIndex = indexEndEnMax
            
            # 如果有重合部分，判断应该分界在哪
            # 如“惊天魔盗团2”，'2 Now You See Me2',惊天魔盗团2.Now.You.See.Me2.2016.WEB-DL.UHD.4K.2160p.X264.AAC-英语中字-BT4K.mp4
            if zhFront and indexEndZhMax>indexStartEnMax:
                if str[:indexStartEnMax].endswith(' '):
                    splitIndex = indexStartEnMax
                else:
                    splitIndex = indexEndZhMax

            if zhFront: # 中文前英文后
                return str[:splitIndex],str[splitIndex:]
            else:
                return str[splitIndex:],str[:splitIndex]
        elif zhPhrases:
            return str,''
        elif enPhrases:
            return '',str



    def _part(self, name, match, raw, clean):
        '''
        name:信息类别 如：season
        match：是所有匹配到的原始数据 如：['S05', '05']
        raw：是匹配到的数据
        clean:是处理好的数据
        '''
        # 记录已匹配到的部分，以排除降低误识别
        if name in types.keys() and types[name] == 'list':
            self.used_raw.extend(raw)
        else:
            self.used_raw.append(raw)
        
        if name in ('audioLang','subLang'):
            tmp = []
            for i in clean:
                ii = re.split('[\-\.&]',i)
                ii = [self._strip(j) for j in ii if j != '']
                tmp.extend(ii)
            clean = tmp

        if self.parts.get(name):
            if name in types.keys() and types[name] == 'list':
                self.parts[name].extend(clean)
        else:
            self.parts[name] = clean
        
        # 如果发现raw、clean内容不同，排除掉integer类型后每个匹配都定位index
        # [ViPHD]超时空同居 How.Long.Will.I.Love.U.2018.WEB-DL.1080P.H264.AAC-JBY@ViPHD.mp4
        # 同时匹配到 [ViPHD] 和 -JBY@ViPHD
        rawcleanMatch = True
        if name not in types.keys() and raw:
            rawcleanMatch = raw.find(str(clean)) != -1

        # 如果有匹配到内容
        if len(match) != 0:
            for i in range(0,len(match)):
                # 查找匹配到的内容在文件名的位置index，逐步缩小范围
                index = self.torrent['name'].find(match[i])
                if index == 0:
                    self.start = len(match[i])
                elif index == -1:
                    pass
                elif self.end is None or index < self.end: 
                    self.end = index
                if rawcleanMatch:
                    break
                    

        if name != 'excess':
            # The instructions for adding excess
            if name == 'group':
                self.group_raw = raw
            if raw is not None:
                # 如果是列表，枚举清除
                if name in types.keys() and types[name] == 'list':
                    for i in raw:
                        self.excess_raw = self.excess_raw.replace(self._strip(i), '',1)
                else:
                    self.excess_raw = self.excess_raw.replace(self._strip(raw), '',1)
                    if not rawcleanMatch:
                        self.excess_raw = self.excess_raw.replace(self._strip(str(clean)), '',1)

    def _late(self, name, clean):
        if name == 'group':
            self._part(name, [], None, self._strip(clean))
        elif name == 'episodeName':
            clean = re.sub('[\._]', ' ', clean)
            clean = re.sub('_+$', '', clean)
            self._part(name, [], None, clean.strip())

    def _strip(self,s):
        return re.sub('^([\s\-\.·〖『「《【]+)|([】〗』」》·\s\-\.]+)$','',s)


    def _prepare(self,name):
        '''
        准备文件名
        '''
        name,self.ext = self._recognizeExt(name)

        # 如果在name里发现超过3个 ][ ，说明是以[xxx][2012][xxx]为格式的命名法，就把它们全部变成.
        if name.count('[') >= 2:
            name = name.replace('][','.')
            name = name.replace('] [','.')
            name = re.sub('(\[(?!.+(?:%s)))'%(GROUPNAMEEND),'.',name).replace('..','.').strip('.')
        name = name.replace('_',' ').replace(',','.')

        # 预提取专有名词 如：ZMZ-BD-MP4、mUHD-FRDS

        for rpattern,fv in preparePatterns.items():
            field,value = fv
            # 判断是否匹配大小写
            if value.find('re!!!!') != -1:
                match = re.findall(rpattern, name) 
                value = value.replace('re!!!!','re!!!')
            else:
                match = re.findall(rpattern, name, re.I) 


            if len(match) == 0: # 匹配不到就继续下一个类目
                continue
            if isinstance(match[0], tuple):
                if len(match) > 1:
                    tmpMatch = []
                    for x in match:
                        tmpMatch.append(sorted(x,key = lambda i:len(i))[-1])
                    match = tmpMatch
                else:
                    match = list(match[0])
                    match = [i for i in match if i != '']
            match = match[0]
            # 用 re!!! 作为标记
            if value.find('re!!!') != -1:
                value = value.replace('re!!!',match)


            # 判断字段是否有信息
            if self.parts.get(field):
                if field in types.keys() and types[field] == 'list':
                    if value not in self.parts[field]:
                        # name清除匹配到内容
                        name = name.replace(match,'')
                        self.parts[field].append(value)
            else: # 如果字段没有信息，直接加入
                # 从回收字段中清除匹配到的回收内容
                name = name.replace(match,'')
                # 对应字段加入匹配到的内容
                if field in types.keys() and types[field] == 'list':
                    self.parts[field] = [self._strip(re.sub('\.','',value))]
                elif field == 'excess':
                    pass
                else:
                    self.parts[field] = self._strip(re.sub('\.','',value))
        
        return name


    def _recycle(self,recycleField):
        '''
        回收title中的可能字段：
        '''
        if self.parts.get(recycleField) or recycleField == 'excess':

            for rpattern,fv in recyclePatterns.items():
                # 判断是否为excess字段
                if recycleField == 'excess':
                    rFieldContent = self.excess_raw
                else:
                    rFieldContent = self.parts[recycleField]
                field,value = fv
                # 判断是否匹配大小写
                if value.find('re!!!!') != -1:
                    match = re.findall(rpattern, rFieldContent) 
                    value = value.replace('re!!!!','re!!!')
                else:
                    match = re.findall(rpattern, rFieldContent, re.I) 

                # 如果是group字段中检测，绕过GROUPNAMESEG里的关键字 如CHD里的HD
                if recycleField == 'group':
                    exist = False
                    for x in match:
                        if x in GROUPNAMESEG:
                            exist = True
                            break
                    if exist:
                        continue
                    if field in ('source'):
                        continue
                # 如果是entitle字段中检测，绕过audioLang,subLang的回收匹配，如：Lolita 会匹配到 ita
                if recycleField in ('enTitle') and field in ('audioLang','subLang'):
                    if not re.findall(u'[\u4e00-\u9fa5]+',str(match)): # 中文除外
                        continue

                if len(match) == 0: # 匹配不到就继续下一个类目
                    continue
                if isinstance(match[0], tuple):
                    if len(match) > 1:
                        tmpMatch = []
                        for x in match:
                            tmpMatch.append(sorted(x,key = lambda i:len(i))[-1])
                        match = tmpMatch
                    else:
                        match = list(match[0])
                        match = [i for i in match if i != '']
                match = match[0]
                # 用 re!!! 作为标记
                if value.find('re!!!') != -1:
                    value = value.replace('re!!!',match)

                # 判断字段是否有信息
                if self.parts.get(field):
                    if field in types.keys() and types[field] == 'list':
                        if value not in self.parts[field]:
                            # 从回收字段中清除匹配到的回收内容
                            if recycleField == 'excess':
                                self.excess_raw = self.excess_raw.replace(match,'')
                            else:
                                self.parts[recycleField] = self._strip(self.parts[recycleField].replace(match,''))
                            # 对应字段加入匹配到的内容
                            self.parts[field].append(value)
                    else:
                        # 清除已经加入的
                        if value.lower() == str(self.parts[field]).lower():
                            if recycleField == 'excess':
                                self.excess_raw= self.excess_raw.replace(match,'')
                else: # 如果字段没有信息，直接加入
                    # 从回收字段中清除匹配到的回收内容
                    if recycleField == 'excess':
                        self.excess_raw = self.excess_raw.replace(match,'')
                    else:
                        self.parts[recycleField] = self._strip(self.parts[recycleField].replace(match,''))
                    # 对应字段加入匹配到的内容
                    if field in types.keys() and types[field] == 'list':
                        self.parts[field] = [self._strip(re.sub('\.','',value))]
                    else:
                        self.parts[field] = self._strip(re.sub('\.','',value))


    def _recognizeExt(self,fullname):
        name,ext = os.path.splitext(fullname)
        if ext.lower() in MEDIAEXT:
            return(name,ext)
        else:
            return(fullname,None)

    def parse(self, name):
        self.parts = {}
        name = self._prepare(name)
        self.torrent = {'name': name}
        self.excess_raw = name
        self.group_raw = ''
        self.start = 0
        self.end = None
        self.title_raw = None
        self.used_raw = []
        self.pure_name = self.torrent['name']
        # 遍历pattern里面的正则规则
        for key, pattern in patterns:

            '''对字段正则规则进行预处理'''
            
            # 如果不是s/e/w，增加边界限制 \b
            if key not in ('season', 'episode', 'website','cd'):
                pattern = r'\b%s\b' % pattern  
            clean_name = self.torrent['name']

            # 如果是'group','season','episode'字段，就使用pure，避免匹配到Blu-ray,WEB-DL里的-号
            if key in ('group','season','episode'):
                clean_name = self._strip(self.pure_name)
                clean_name = re.sub('\W+\-','-',clean_name)
                clean_name = re.sub('(\W{2,}|\-)$','',clean_name)


            
            '''正则匹配'''
            match = re.findall(pattern, clean_name, re.I)
            match = [i for i in match if i != '']  # 清理空值
            if len(match) == 0: # 匹配不到就继续下一个类目
                continue

            if key in types.keys() and types[key] == 'list': # 如果预处理已经匹配到了就不用再匹配了
                pass
            else:
                if self.parts.get(key):
                    continue

            '''定位、处理匹配结果'''
            index = {}

            if isinstance(match[0], tuple):
                if len(match) > 1:
                    tmpMatch = []
                    for x in match:
                        tmpMatch.append(sorted(x,key = lambda i:len(i))[-1])
                    match = tmpMatch
                else:
                    match = list(match[0])
                    match = [i for i in match if i != '']

            if len(match) > 1:
                #第一个匹配的是完整片段，第二个匹配的是纯信息
                index['raw'] = 0
                index['clean'] = 1
            else: # 如果没匹配到,或只匹配到一个 如：1080p
                index['raw'] = 0
                index['clean'] = 0

            # 消除 TimeSpy....初心字幕组 情况
            if key in ('group') and len(match[0])>10 and match[0].count('.')>2:
                continue

            # 把之前匹配到的文字全部删除放在pure里以备调用，避免匹配到Blu-ray,WEB-DL里的-号
            isReplace = True
            for ur in match:
                if ur.upper() in GROUPNAMESEG: # 排除下4K之类 易出现在压制组名的关键字
                    isReplace = False
            
            if isReplace:
                self.pure_name = re.sub(pattern,'',self.pure_name,re.I)


            #根据 字段-类型 转换匹配到的str为相应的类型 eg: season对应integer
            if key in types.keys() and types[key] == 'boolean':
                clean = True
            else:
                clean = self._strip(match[index['clean']].strip('.'))
                if key in types.keys() and types[key] == 'integer':
                    if match[0].lower().find('dual') != -1:
                        clean = 2
                    elif match[0].lower().find('tri') != -1:
                        clean = 3
                    elif match[0].lower().find('quad') != -1:
                        clean = 4
                    elif match[0].lower().find('multi') != -1:
                        clean = 0
                    else:
                        clean = int(clean)


            if key == 'group':
                clean = re.sub('\]|\[','',clean)
                if re.match('[^ ]+ [^ ]+ .+', clean):
                    key = 'episodeName'
            if key == 'episode':
                sub_pattern = self._escape_regex(match[index['raw']])
                self.torrent['map'] = re.sub(
                    sub_pattern, '{episode}', self.torrent['name']
                )# ????

            '''提交记录给part'''
            if key in types.keys() and types[key] == 'list':
                self._part(key, match, match, match)
            else:
                self._part(key, match, match[index['raw']], clean)

        # 提取title字段：通过start和end定位，清除杂项
        raw = self.torrent['name']
        # 特殊处理年份后的中字
        guess = False
        if self.parts.get('year'):
            yearEndPos = raw.index(str(self.parts['year']))+len(str(self.parts['year']))
            afterYearStr = raw[yearEndPos+1:]
            segments = [i for i in re.split('\.|\s',afterYearStr) if i != '']
            if len(segments)>2:
                if re.findall('[\u4e00-\u9fa5]',segments[0]) and not re.findall('[\u4e00-\u9fa5]',segments[1]):  
                    self.end = raw.find(segments[0])+len(segments[0])
                    guess = True

        if self.end is not None:
            raw = raw[self.start:self.end]
        else:
            raw = raw[self.start:]

        # 特殊处理年份后的中字,删除年份
        if guess:
            raw = raw.replace(str(self.parts['year']),'')

        if not re.findall(u'\([\u4e00-\u9fa5]{1,2}\)',raw):# 如果有 (港) 之类的单字 跳过
            raw = raw.split('(')[0]
        clean = re.sub('^ -', '', raw)
        if clean.find(' ') == -1 and clean.find('.') != -1:
            clean = re.sub('\.', ' ', clean)
        clean = re.sub('_', ' ', clean)
        clean = re.sub('([\[\(_]|- )$', '', clean).strip()
        clean = re.sub('[`~!@#\$%\^&\*\(\)_\\\+=\?:"\{\}\|,\.\/;\'\[\]￥……（）\|〗〖『』「」《》【】]+',' ',clean)

        splitResult = self._splitStrBorder(clean)
        if splitResult:
            zhTitle,enTitle = splitResult
            if zhTitle:
                self._part('zhTitle', [], raw, self._strip(zhTitle))
            if enTitle:
                self._part('enTitle', [], raw, self._strip(enTitle))


        # 回收'excess','zhTitle','enTitle','group'里的字段
        for recycleField in ('excess','zhTitle','enTitle','group'):
            self._recycle(recycleField)


        # 提取最后的excess字段：
        clean = re.sub('(^[-\. ()]+)|([-\. ]+$)', '', self.excess_raw)
        clean = re.sub('[\(\)\/]', ' ', clean)
        match = re.split('\.\.+| +', clean)
        if len(match) > 0 and isinstance(match[0], tuple):
            match = list(match[0])

        clean = filter(bool, match)
        clean = [item for item in filter(lambda a: a != '-', clean)]
        clean = [item.strip('-') for item in clean]
        clean = [self._strip(item) for item in clean]
        clean = [i for i in clean if i != '']  # 清理空值

        if len(clean) != 0:
            group_pattern = clean[-1] + self.group_raw
            if self.torrent['name'].find(group_pattern) == \
                    len(self.torrent['name']) - len(group_pattern):
                self._late('group', clean.pop() + self.group_raw)

            if 'map' in self.torrent.keys() and len(clean) != 0:
                episode_name_pattern = (
                    '{episode}'
                    '' + re.sub('_+$', '', clean[0])
                )
                if self.torrent['map'].find(episode_name_pattern) != -1:
                    self._late('episodeName', clean.pop(0))

        if len(clean) != 0:
            if len(clean) == 1:
                clean = clean[0]
            self._part('excess', [], self.excess_raw, clean)
        return self.parts


ptn = PTN()

def parse(name):
    return ptn.parse(name)

