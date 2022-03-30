#!/usr/bin/env python
# -*-coding:utf-8 -*-
from ast import If
from qbittorrentapi import Client
import re
import sys
import time
import requests
import json
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
# qbittorrent 设置：设置-下载-Torrent 完成时运行外部程序：
# python3 /config/run.py "%I"
#========================================================


#======================== 配置 ================================
host = '127.0.0.1:8080'
username = 'admin'
password = 'adminadmin'
CATEGORY_TV = ['TV'] # 添加S01分类
CATEGORY_MOVIE = ['movie', 'rss_movie']
CATEGORY_OTHER = ['tmp']
logfile = r"/config/log.txt"

# TMDB API
tmdb.api_key = 'xxxxxxxxxxxxxxxxxxx'
tmdb.language = 'zh'

# 企业微信推送
__corpid = 'xxxxxxxx'
__corpsecret = 'xxxxxxxxxx'
__agent_id = '1000000'
send_user = 'admin'

#====================== 配置结束 ================================
client = Client(host=host, username=username, password=password)
def print_log(log_file, txt): 
    print(txt)
    txt = '%s\t%s\n' % (time.strftime('%Y/%m/%d %H:%M:%S',
                        time.localtime(time.time())), str(txt))
    f = open(log_file, "a", encoding='utf-8')
    f.write(txt)
    f.close()

def year(path):
    root_path = path.split("/", 1)
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

# 删除文件不存在种子
for torrent in client.torrents_info():
    if torrent.state == 'missingFiles':
        print_log(logfile, f'已删除：{torrent.state}:{torrent.name}[{torrent.category}]')
        client.torrents_delete(delete_files=True, torrent_hashes=torrent.hash)
    # print_log(logfile, f'状态：{torrent.state}\n名字：{torrent.name}\n分类：{torrent.category}')

HASH = sys.argv[1]

torrent = client.torrents.info(torrent_hashes=HASH)[0]

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


tmdb_info_title = tmdb_info_text  = num = vote_average = res_overview = None

if torrent.category in CATEGORY_MOVIE:
    if media_info_year is not None:
        search = Search().movies({"query": media_info_title, "year": media_info_year})
    else:
        search = Search().movies({"query": media_info_title})
    if search :
        res = search[0]
        response = requests.get('https://api.themoviedb.org/3/genre/movie/list?api_key=%s&language=%s' % (tmdb.api_key, tmdb.language))
        genre_movie = json.loads(response.text)
        genre_ids = ','.join([x['name'] for x in genre_movie["genres"] if x['id'] in res.genre_ids])
        num = res.vote_average
        if num <= 2.5:
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
        movie_title = '%s(%s) %s' % (res.title, media_info_year, genre_ids)
        movie_text = '评分：%s %s\n%s' % (num, vote_average, res.overview)
        movie_image_url = "https://image.tmdb.org/t/p/w780%s" % image_path
        movie_media_url ="https://www.themoviedb.org/movie/%s" %res.id
        send_image_message(movie_title, movie_text, movie_image_url, movie_media_url)
        tmdb_info_title = movie_title
        tmdb_info_text = movie_text
        res_overview = res.overview
    else:
        print_log(logfile, f'抱歉，没有在 TMDB 搜索到信息')

if torrent.category in CATEGORY_TV:
    if media_info_year is not None: 
        search = Search().tv_shows({"query": media_info_title, "first_air_date_year": media_info_year})
    else:
        search = Search().tv_shows({"query": media_info_title})
    if search :
        res = search[0]
        response = requests.get('https://api.themoviedb.org/3/genre/tv/list?api_key=%s&language=%s' % (tmdb.api_key, tmdb.language))
        genre_tv = json.loads(response.text)
        genre_ids = ','.join([x['name'] for x in genre_tv["genres"] if x['id'] in res.genre_ids])
        num = res.vote_average
        if num <= 2.5:
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
        tv_title = '%s(%s) %s' % (res.name, media_info_year, genre_ids)
        tv_text = '评分：%s %s\n%s' % (num, vote_average, res.overview)
        tv_image_url = "https://image.tmdb.org/t/p/w780%s" % image_path
        tv_media_url = "https://www.themoviedb.org/tv/%s" %res.id
        send_image_message(tv_title, tv_text, tv_image_url, tv_media_url)
        tmdb_info_title = tv_title
        tmdb_info_text = tv_text
        res_overview = res.overview
    else:
        print_log(logfile, f'抱歉，没有在 TMDB 搜索到信息')


print_log(logfile, '-------------------------------------')
print_log(logfile, '')
print_log(logfile, f'         名字：{media_info_title}')
print_log(logfile, f'         年份：{media_info_year}')
print_log(logfile, f'         分类：{torrent.category}')
print_log(logfile, '          ~~~~~~~~~~~~~~~~~~~~~~~~~~~')
print_log(logfile, f'         TMDB 标题：{tmdb_info_title}')
print_log(logfile, f'         TMDB 评分：{num} {vote_average}')
print_log(logfile, f'         TMDB 简介：{res_overview}')
print_log(logfile, '')
print_log(logfile, '-------------------------------------')

# 不在分类中的退出
CATEGORY_ALL = list(filter(None, CATEGORY_TV + CATEGORY_MOVIE + CATEGORY_OTHER))
if torrent.category not in CATEGORY_ALL:
    print_log(logfile, f'退出。不在分类中：名字：{torrent.name} 分类：{torrent.category}')
    exit()

# 改名
if torrent.category in CATEGORY_TV:
    files_no = 0
    for torrent_file in torrent.files:
        files_no = files_no + 1
        print_log(logfile, f'文件{files_no} 名字：{torrent.name} 分类：{torrent.category}')
        for oldPath in torrent_file.name.splitlines():
            if not re.search(r's[0-9]{1,2}ep?[0-9]{1,2}', oldPath, flags=re.I):
                path = re.sub(r'ep?([0-9]{1,2})', 'S01E\g<1>', oldPath, flags=re.I)
            else:
                path = oldPath
            newPath = year(path)
            # client.torrents_rename_file(torrent_hash=HASH, old_path=oldPath, new_path=newPath)
            print_log(logfile, f'oldPath: {oldPath}')
            print_log(logfile, f'newPath: {newPath}')
else:
    for torrent_file in torrent.files:
        oldPath = torrent_file.name.splitlines()[0]
        path = oldPath
        newPath = year(path)
        oldPath = oldPath.split("/", 1)[0]
        newPath = newPath.split("/", 1)[0]
        # client.torrents_rename_folder(torrent_hash=HASH, old_path=oldPath, new_path=newPath)
        print_log(logfile, f'oldPath: {oldPath}')
        print_log(logfile, f'newPath: {newPath}')
        break

def logcut(log_file, num):
    f = open(log_file , "r", encoding='utf-8')
    count = len(f.readlines())
    f.close()
    if count > num:
        with open(log_file, encoding='utf-8') as f:
            lines = f.readlines()

        def remove_comments(lines):
            return [line for line in lines if line.startswith("#") == False]

        def remove_n_line(lines, n):
            return lines[n if n<= len(lines) else 0:]

        lines = remove_n_line(lines, count - num)

        f = open(log_file, "w", encoding='utf-8') # save on new_file
        f.writelines(lines)
        f.close()
    return
logcut(logfile, 1000) # 仅保留 1000 行日志
