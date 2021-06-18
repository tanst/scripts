## 说明
同时修改 * 和 @ 的 A、AAAA 记录，必须首先手动创建这 4 项条目，IP 任意，最后都要动态修改

IPv6 地址有更改，改为内网群晖的地址后缀

## 原理

#### 1. 获取公网 IP
IPv4 首先通过网卡获取公网 IP，如未获取，再通过 curl 外网获取
IPv6 直接通过 curl 外网获取

#### 2. 获取 dnspod 解析记录
通过 dnspod 官方 API 获取 * 和 @ 的 A、AAAA 记录，同时获取记录 ID，方便后面更改

#### 3. 比对
通过比对本地获取的 IP 和 dnspod 记录的 IP，判断是否需要更新

#### 4. 更新
通过第三步比对，如果记录不一致，则通过 dnspod 官方 API 进行修改

#### 5. 通知
更新后可通过微信和邮件通知

## 备选CHECKURL
- [`http://icanhazip.com`](http://icanhazip.com)
- [`http://ip.3322.org/`](http://ip.3322.org)
- [`http://ip.3322.net/`](http://ip.3322.net)
- [`http://myip.ipip.net/`](http://myip.ipip.net)
- [`http://checkip.dns.he.net/`](http://checkip.dns.he.net)
- [`http://ifconfig.me/`](http://ifconfig.me)
- [`http://ident.me/`](http://ident.me)
- [`http://whatismyip.akamai.com/`](http://whatismyip.akamai.com)
- [`http://members.3322.org/dyndns/getip/`](http://members.3322.org/dyndns/getip/)
- [`http://ipv4.ip.sb`](http://ipv4.ip.sb)
- [`http://ip.cip.cc`](http://ip.cip.cc)
- [`http://myip.dnsomatic.com`](http://myip.dnsomatic.com)
- [`http://checkip.dyndns.com/`](http://checkip.dyndns.com/)
