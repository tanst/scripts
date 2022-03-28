#!/usr/bin/env python
# -*-coding:utf-8 -*-
#========================================================
# 使用说明：
# 需安装 python3
# 需安装依赖 API ：https://qbittorrent-api.readthedocs.io/en/latest/#installation
# 同目录脚本依赖：common.py const.py
# 脚本根据分类执行相关操作：
# [总分类]自动重命名为：中文（年份）-原文件名
# [添加S01分类]自动判断添加 S01 并自动重命名为：中文（年份）-原文件名
# 利用 qbittorrent 下载完成时运行外部程序进行重命名方便搜刮器搜刮，不影响做种
# 脚本放置 /config 目录下
# qbittorrent 设置：设置-下载-Torrent 完成时运行外部程序：
# python3 /config/run.py "%I"
#========================================================
from qbittorrentapi import Client
import re
import sys
import time


client = Client(host='127.0.0.1:8080', username='admin', password='adminadmin')

CATEGORY_ARRAY = ['TV', 'movie', 'rss_movie']

## 添加S01分类 ##
CATEGORY_ARRAY_S = ['TV']


def print_log(log_file, txt):
    log_file = r"/config/log.txt"  # 日志
    print(txt)
    txt = '%s\t%s\n' % (time.strftime('%Y/%m/%d %H:%M:%S',
                        time.localtime(time.time())), str(txt))
    f = open(log_file, "a", encoding='utf-8')
    f.write(txt)
    f.close()


def year(path):
    from common import parse
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
        print_log(0, f'已删除：{torrent.state}:{torrent.name}[{torrent.category}]')
        client.torrents_delete(delete_files=True, torrent_hashes=torrent.hash)
    # print_log(0, f'状态：{torrent.state}\n名字：{torrent.name}\n分类：{torrent.category}')

HASH = sys.argv[1]

torrent = client.torrents.info(torrent_hashes=HASH)[0]

print_log(0, '-------------------------------------')
print_log(0, '\n')
print_log(0, f'         {torrent.name}')
print_log(0, '\n')
print_log(0, '-------------------------------------')
# 不在分类中的退出
if torrent.category not in CATEGORY_ARRAY:
    print_log(0, f'退出。不在分类中：名字：{torrent.name} 分类：{torrent.category}')
    exit()
if torrent.category in CATEGORY_ARRAY_S:
    files_no = 0
    for torrent_file in torrent.files:
        files_no = files_no + 1
        print_log(0, f'文件{files_no} 名字：{torrent.name} 分类：{torrent.category}')
        for oldPath in torrent_file.name.splitlines():
            if not re.search(r's[0-9]{1,2}ep?[0-9]{1,2}', oldPath, flags=re.I):
                path = re.sub(r'ep?([0-9]{1,2})', 'S01E\g<1>', oldPath, flags=re.I)
            else:
                path = oldPath
            newPath = year(path)
            client.torrents_rename_file(torrent_hash=HASH, old_path=oldPath, new_path=newPath)
            print_log(0, f'oldPath: {oldPath}')
            print_log(0, f'newPath: {newPath}')
else:
    for torrent_file in torrent.files:
        oldPath = torrent_file.name.splitlines()[0]
        path = oldPath
        newPath = year(path)
        oldPath = oldPath.split("/", 1)[0]
        newPath = newPath.split("/", 1)[0]
        client.torrents_rename_folder(torrent_hash=HASH, old_path=oldPath, new_path=newPath)
        print_log(0, f'oldPath: {oldPath}')
        print_log(0, f'newPath: {newPath}')
        break

def logcut(logfile, num):
    f = open(logfile , "r", encoding='utf-8')
    count = len(f.readlines())
    f.close()
    if count > num:
        with open(logfile, encoding='utf-8') as f:
            lines = f.readlines()

        def remove_comments(lines):
            return [line for line in lines if line.startswith("#") == False]

        def remove_n_line(lines, n):
            return lines[n if n<= len(lines) else 0:]

        lines = remove_n_line(lines, count - num)

        f = open(logfile, "w", encoding='utf-8') # save on new_file
        f.writelines(lines)
        f.close()
    return
logcut('/config/log.txt', 1000) # 仅保留 1000 行日志
