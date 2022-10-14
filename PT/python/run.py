#!/usr/bin/env python
# -*-coding:utf-8 -*-
from os.path import join, getsize
import os
from qbittorrentapi import Client
import json,os,requests,time,sys,re
from common import parse
from tmdbv3api import TMDb, Search
tmdb = TMDb()
#========================================================
# 使用说明：
# 需安装 python3
# 需安装依赖库 ：https://qbittorrent-api.readthedocs.io/en/latest/#installation
# 同目录脚本依赖：common.py const.py
# 脚本根据分类执行相关操作：
# [所有分类]自动重命名为：中文（年份）-原文件名
# [ MOVIE & TV 分类] 搜索 TMDB 数据并推送
# [ TV 分类]自动判断添加 S01 并自动重命名为：中文（年份）-原文件名
# 利用 qbittorrent 下载完成时运行外部程序进行重命名方便搜刮器搜刮，不影响做种
# 脚本放置 /config 目录下
# 配置文件: config.json
# qbittorrent 设置：设置-下载-Torrent 完成时运行外部程序：
# python3 /config/run.py "%I"
#========================================================


#====================== 导入配置================================
# load configuration from file
CONFIG_FILE = 'config.json'
CONFIG_PATH = os.path.join(os.path.dirname(
    os.path.realpath(__file__)), CONFIG_FILE)
CONFIG_DATA = {
    'host' : '127.0.0.1:8080',
    'username' : 'admin',
    'password' : 'adminadmin',
    'CATEGORY_TV' : 'TV', # 添加S01分类
    'CATEGORY_MOVIE' : 'movie, rss_movie',
    'CATEGORY_OTHER' : 'tmp',
    'logfile' : 'run.log',

    # TMDB API
    'tmdb_api_key' : '07851a893juhjdf903ju4fae09c9cb3bb4b',
    'tmdb_language' : 'zh',

    # 企业微信推送
    '__corpid' : 'ww0jdf8d0fj08ja6b2',
    '__corpsecret' : 'Ini05h745h7457h457hcv0_kdASRY045h74h74h6zlns',
    '__agent_id' : '1000000',
    'send_user' : '@all'
}


def load_configuration():
    global CONFIG_PATH, CONFIG_DATA
    try:
        # try to load user data from file
        with open(CONFIG_PATH) as f:
            CONFIG_DATA = json.load(f)
    except Exception:
        # if file doesn't exist, we create it
        with open(CONFIG_PATH, 'w') as f:
            f.write(json.dumps(CONFIG_DATA, indent=4, sort_keys=False))

load_configuration()

host = CONFIG_DATA['host']
username = CONFIG_DATA['username']
password = CONFIG_DATA['password']
CATEGORY_TV = CONFIG_DATA['CATEGORY_TV'].split(",")
CATEGORY_MOVIE = CONFIG_DATA['CATEGORY_MOVIE'].split(",")
CATEGORY_OTHER = CONFIG_DATA['CATEGORY_OTHER'].split(",")
CATEGORY_ALL = [*CATEGORY_TV, *CATEGORY_MOVIE, *CATEGORY_OTHER]
logfile = os.path.join(os.path.dirname(os.path.realpath(__file__)), CONFIG_DATA['logfile'])
tmdb.api_key = CONFIG_DATA['tmdb_api_key']
tmdb.language = CONFIG_DATA['tmdb_language']
__corpid = CONFIG_DATA['__corpid']
__corpsecret = CONFIG_DATA['__corpsecret']
__agent_id = CONFIG_DATA['__agent_id']
send_user = CONFIG_DATA['send_user']
#====================== 配置结束 ================================#
client = Client(host=host, username=username, password=password)
def print_log(log_file, txt): 
    print(txt)
    txt = '%s\t%s\n' % (time.strftime('%Y/%m/%d %H:%M:%S',
                        time.localtime(time.time())), str(txt))
    f = open(log_file, "a+", encoding='utf-8')
    f.write(txt)
    f.close()

def logcut(log_file, num):
    f = open(log_file , "r", encoding='utf-8')
    count = len(f.readlines())
    f.close()
    if count > num:
        with open(log_file, encoding='utf-8') as f:
            lines = f.readlines()

        def remove_n_line(lines, n):
            return lines[n if n<= len(lines) else 0:]

        lines = remove_n_line(lines, count - num)

        f = open(log_file, "w", encoding='utf-8') # save on new_file
        f.writelines(lines)
        f.close()
    return

def year(path):
    root_path = path.split("/", 1)
    root_path[0] = re.sub(r'.mkv|.mp4|.avi|.rmvb|.rm|.mpg|.mpeg|.ts|.mov|.wmv|.m2ts', '', root_path[0])
    root_path[0] = root_path[0].replace(' ', '.')
    check = re.search(r'(.+)\((\d{4})\)\D', root_path[0]) # 检测有无 (年份)
    if check:
        check_name = check.group(1)
        check_year = check.group(2)
        if re.search(r'[\u4E00-\u9FA5]', check_name):
            print_log(logfile, f'名字是 汉字(年份)，跳过重命名')
            newPath = path
        else:
            if tmdb_title:
                s = root_path[0].replace(check_name, tmdb_title, 1)
                s = s.replace(check_year, tmdb_year, 1)
                newPath = f'{s}/{root_path[1]}'
            else:
                newPath = path
    else:
        if tmdb_title:
            newPath = f'{tmdb_title}({tmdb_year})-{root_path[0]}/{root_path[1]}'
        else:
            if parse(root_path[0]).get('year'):
                if parse(root_path[0]).get('zhTitle'):
                    title = parse(root_path[0]).get('zhTitle')
                else:
                    title = parse(root_path[0]).get('enTitle')
                years = parse(root_path[0]).get('year')
                newPath = f'{title}({years})-{root_path[0]}/{root_path[1]}'
            else:
                newPath = path
    return newPath

# 发送图文消息
def send_image_message(title, text, image_url, media_url):
    
    token_url = "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=%s&corpsecret=%s" % (__corpid, __corpsecret)
    res = requests.get(token_url)
    if res:
        ret_json = res.json()
        if ret_json['errcode'] == 0:
            __access_token = ret_json['access_token']

    message_url = 'https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=%s' % __access_token
    res = requests.get(token_url)
    if text:
        text = text.replace("\n\n", "\n")
    req_json = {
        "touser": send_user,
        "msgtype": "news",
        "agentid": __agent_id,
        "news": {
            "articles": [
                {
                    "title": title,
                    "description": text,
                    "url": media_url,
                    "picurl": image_url
                }
            ]
        }
    }
    headers = {'content-type': 'charset=utf8'}
    try:
        res = requests.post(message_url, json=req_json, headers=headers)
        if res:
            ret_json = res.json()
            if ret_json['errcode'] == 0:
                return True, ret_json['errmsg']
            else:
                return False, ret_json['errmsg']
        else:
            return False, None
    except Exception as err:
        return False, str(err)

# 发送文本消息
def send_text_message(text):
    
    token_url = "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=%s&corpsecret=%s" % (__corpid, __corpsecret)
    res = requests.get(token_url)
    if res:
        ret_json = res.json()
        if ret_json['errcode'] == 0:
            __access_token = ret_json['access_token']

    message_url = 'https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=%s' % __access_token
    res = requests.get(token_url)
    if text:
        text = text.replace("\n\n", "\n")
    req_json = {
        "touser": send_user,
        "msgtype": "text",
        "agentid": __agent_id,
        "text": {
            "content": text
        }
    }
    headers = {'content-type': 'charset=utf8'}
    try:
        res = requests.post(message_url, json=req_json, headers=headers)
        if res:
            ret_json = res.json()
            if ret_json['errcode'] == 0:
                return True, ret_json['errmsg']
            else:
                return False, ret_json['errmsg']
        else:
            return False, None
    except Exception as err:
        return False, str(err)

# 删除文件不存在种子
for torrent in client.torrents_info():
    if torrent.state == 'missingFiles':
        print_log(logfile, f'已删除：{torrent.state}:{torrent.name}[{torrent.category}]')
        client.torrents_delete(delete_files=True, torrent_hashes=torrent.hash)
    # print_log(logfile, f'状态：{torrent.state}\n名字：{torrent.name}\n分类：{torrent.category}')


# ===================== 删除 rss_movie 多余种子 start ===================== #

def hum_convert(value):
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    size = 1024.0
    for i in range(len(units)):
        if (value / size) < 1:
            return "%.2f %s" % (value, units[i])
        value = value / size
        
dir = '/rss_media/movie/'
print_log(logfile, f'开始检测 {dir} 空间大小：')
def getdirsize(dir):
    size = 0
    for root, dirs, files in os.walk(dir):
        size += sum([getsize(join(root, name)) for name in files])
    return size

if __name__ == '__main__':
    total_size = getdirsize(dir)
    print_log(logfile, f'There are {hum_convert(total_size)} in {dir}')

print_log(logfile, f'总大小： {hum_convert(total_size)}({total_size})')
b = 1003948605440 - total_size
print_log(logfile, f'剩余空间：{hum_convert(1003948605440 - total_size)}({1003948605440 - total_size})')

while total_size > 1003948605440: # 935 GB
    old_torrent_name = client.torrents_info(category='rss_movie', sort='added_on')[0].name
    old_torrent_humsize = hum_convert(client.torrents_info(category='rss_movie', sort='added_on')[0].size)
    old_torrent_size = client.torrents_info(category='rss_movie', sort='added_on')[0].size
    print_log(logfile, f'存储已满，开始删除最旧种子：{old_torrent_name}[{old_torrent_humsize}]({old_torrent_size})')
    send_text_message('存储已满，删除最旧种子：%s [%s](%s)' % (old_torrent_name,old_torrent_humsize,old_torrent_size))
    client.torrents_delete(delete_files=True, torrent_hashes=client.torrents_info(category='rss_movie', sort='added_on')[0].hash)
    time.sleep( 30 )
    total_size = getdirsize(dir)
    print_log(logfile, f'删除后，总大小：{hum_convert(total_size)}({total_size})')
print_log(logfile, f'检测 {dir} 空间大小结束')
# ===================== 删除多余种子 end ===================== #

HASH = sys.argv[1]
torrent = client.torrents.info(torrent_hashes=HASH)[0]

# 检测是否存在目录，不存在自动创建
if '/' not in str(torrent.files):
    for torrent_file in torrent.files:
        oldPath= torrent_file.name
        newPath = re.sub(r'.mkv|.mp4|.avi|.rmvb|.rm|.mpg|.mpeg|.ts|.mov|.wmv|.m2ts', '', torrent.name)
        new_torrent_name = newPath
        newPath = f'{newPath}/{oldPath}'
        client.torrents_rename(torrent_hash=HASH, new_torrent_name=new_torrent_name)
        client.torrents_rename_file(torrent_hash=HASH, old_path=oldPath, new_path=newPath)
        print('oldPath:', oldPath)
        print('newPath:', newPath)

# 重新获取信息
client = Client(host=host, username=username, password=password)
torrent = client.torrents.info(torrent_hashes=HASH)[0]

# 不在分类中的退出
if torrent.category not in CATEGORY_ALL:
    print_log(logfile, f'退出。不在分类中：名字：{torrent.name} 分类：{torrent.category}')
    exit()

# 获取 名字、年份、类型
if parse(torrent.name).get('year'):
    media_info_year = parse(torrent.name).get('year')
else:
    media_info_year = None
if parse(torrent.name).get('zhTitle'):
    media_info_title = parse(torrent.name).get('zhTitle')
else:
    media_info_title = parse(torrent.name).get('enTitle')
    media_info_title = re.sub(r'\WS\d{2}', '', media_info_title, flags=re.I)

# 搜索 TMDB 信息

num = None
vote_average = None
tmdb_overview = None
tmdb_title = None
tmdb_genre = None
tmdb_year = None

# 检测 api.themoviedb.org 连接性
try:
    html = requests.get('https://api.themoviedb.org', timeout=5).text
    print_log(logfile, f'success: 连接 api.themoviedb.org 成功')
except requests.exceptions.RequestException as e:
    print_log(logfile, f'error: 连接 api.themoviedb.org 超时，请检测网络后重试')
    send_text_message('种子名：%s\n连接 api.themoviedb.org 超时，请检测网络后重试' % (torrent.name))
    exit()


if torrent.category in CATEGORY_MOVIE:
    if media_info_year is not None:
        search = Search().movies({"query": media_info_title, "year": media_info_year})
    else:
        search = Search().movies({"query": media_info_title})
    if search :
        res = search[0]
        response = requests.get('https://api.themoviedb.org/3/genre/movie/list?api_key=%s&language=%s' % (tmdb.api_key, tmdb.language))
        genre_movie = json.loads(response.text)
        tmdb_genre = ','.join([x['name'] for x in genre_movie["genres"] if x['id'] in res.genre_ids])
        num = res.vote_average
        if num <= 1:
            vote_average = '☆☆☆☆☆'
        elif num > 1 and num <= 2.5:
            vote_average = '★☆☆☆☆'
        elif num > 2.5 and num <= 4.5:
            vote_average = '★★☆☆☆'
        elif num > 4.5 and num <= 6.5:
            vote_average = '★★★☆☆'
        elif num > 6.5 and num <= 8.5:
            vote_average = '★★★★☆'
        elif num > 8.5 and num <= 10:
            vote_average = '★★★★★'
        if res.backdrop_path:
            image_path = res.backdrop_path
        else:
            image_path = res.poster_path
        tmdb_title = res.title
        tmdb_year = re.search('\d{4}', res.release_date).group(0)
        tmdb_image_url = "https://image.tmdb.org/t/p/w780%s" % image_path
        tmdb_url ="https://www.themoviedb.org/movie/%s" %res.id
        tmdb_overview = res.overview
    else:
        print_log(logfile, f'抱歉，没有在 TMDB 搜索到 "{media_info_title}" 的信息')

if torrent.category in CATEGORY_TV:
    if media_info_year is not None: 
        search = Search().tv_shows({"query": media_info_title, "first_air_date_year": media_info_year})
    else:
        search = Search().tv_shows({"query": media_info_title})
    if search :
        res = search[0]
        response = requests.get('https://api.themoviedb.org/3/genre/tv/list?api_key=%s&language=%s' % (tmdb.api_key, tmdb.language))
        genre_tv = json.loads(response.text)
        tmdb_genre = ','.join([x['name'] for x in genre_tv["genres"] if x['id'] in res.genre_ids])
        num = res.vote_average
        if num <= 1:
            vote_average = '☆☆☆☆☆'
        elif num > 1 and num <= 2.5:
            vote_average = '★☆☆☆☆'
        elif num > 2.5 and num <= 4.5:
            vote_average = '★★☆☆☆'
        elif num > 4.5 and num <= 6.5:
            vote_average = '★★★☆☆'
        elif num > 6.5 and num <= 8.5:
            vote_average = '★★★★☆'
        elif num > 8.5 and num <= 10:
            vote_average = '★★★★★'
        if res.backdrop_path:
            image_path = res.backdrop_path
        else:
            image_path = res.poster_path
        tmdb_title = res.name
        tmdb_year = re.search('\d{4}', res.first_air_date).group(0)
        tmdb_image_url = "https://image.tmdb.org/t/p/w780%s" % image_path
        tmdb_url = "https://www.themoviedb.org/tv/%s" %res.id
        tmdb_overview = res.overview
    else:
        print_log(logfile, f'抱歉，没有在 TMDB 搜索到 "{media_info_title}" 的信息')


print_log(logfile, '-------------------------------------')
print_log(logfile, '')
print_log(logfile, f'         种子名字：{torrent.name}')
print_log(logfile, f'         种子大小：{hum_convert(torrent.size)}')
print_log(logfile, f'         分类：{torrent.category}')
if tmdb_title:
    print_log(logfile, '          ~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    print_log(logfile, f'         TMDB 标题：{tmdb_title}({tmdb_year})')
    print_log(logfile, f'         TMDB 类型：{tmdb_genre}')
    print_log(logfile, f'         TMDB 评分：{num} {vote_average}')
    print_log(logfile, f'         TMDB 简介：{tmdb_overview}')
print_log(logfile, '')
print_log(logfile, '-------------------------------------')


# 改名
if torrent.category in CATEGORY_TV:
    files_no = 0
    season = []
    episode = []
    for torrent_file in torrent.files:
        oldPath = torrent_file.name
        files_no = files_no + 1
        print_log(logfile, f'文件{files_no} 名字：{torrent.name} 分类：{torrent.category}')
        if not re.search(r's[0-9]{1,2}ep?[0-9]{1,2}', oldPath, flags=re.I):
            path = re.sub(r'ep?([0-9]{1,2})', 'S01E\g<1>', oldPath, flags=re.I)
        else:
            path = oldPath
        newPath = year(path)
        client.torrents_rename_file(torrent_hash=HASH, old_path=oldPath, new_path=newPath)

        print_log(logfile, f'oldPath: {oldPath}')
        print_log(logfile, f'newPath: {newPath}')
        se = re.search(r's([0-9]{1,2})ep?([0-9]{1,2})', newPath, flags=re.I)
        if se:
            season.append(se.group(1))
            episode.append(se.group(2))
        else:
            continue
    season = list(set(season))
    season = list(map(int,season))
    season.sort()
    season = ','.join(list(map(str,season)))
    episode = list(set(episode))
    episode = list(map(int,episode))
    episode.sort()
    episode = ','.join(list(map(str,episode)))
    new_torrent_name = newPath.split("/", 1)[0]
    client.torrents_rename(torrent_hash=HASH, new_torrent_name=new_torrent_name)
    if tmdb_title:
        send_image_message('%s(%s) %s' % (tmdb_title, tmdb_year, tmdb_genre), '第 %s 季，第 %s 集\n评分：%s %s\n%s' % (season, episode, num, vote_average, res.overview), tmdb_image_url, tmdb_url)
    else:
        send_text_message('<a href=\"%s\">%s</a>\n下载完成，但是没有在 TMDB 搜索到相关的信息，请手动处理。' % (host, media_info_title))
else:
    if tmdb_title:
        send_image_message('%s(%s) %s' % (tmdb_title, tmdb_year, tmdb_genre), '评分：%s %s\n%s' % (num, vote_average, res.overview), tmdb_image_url, tmdb_url)
    else:
        send_text_message('<a href=\"%s\">%s</a>\n下载完成，但是没有在 TMDB 搜索到相关的信息，请手动处理。' % (host, media_info_title))
    for torrent_file in torrent.files:
        oldPath = torrent_file.name.splitlines()[0]
        newPath = year(oldPath)
        oldPath = oldPath.split("/", 1)[0]
        newPath = newPath.split("/", 1)[0]
        client.torrents_rename_folder(torrent_hash=HASH, old_path=oldPath, new_path=newPath)
        print_log(logfile, f'oldPath: {oldPath}')
        print_log(logfile, f'newPath: {newPath}')
        new_torrent_name = newPath
        client.torrents_rename(torrent_hash=HASH, new_torrent_name=new_torrent_name)
        break
logcut(logfile, 100000) # 仅保留 10000 行日志
