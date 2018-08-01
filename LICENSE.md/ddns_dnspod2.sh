#!/bin/sh

API_ID=0000
API_Token=00000000000000000000000000000
domain=abc.com
host=ddns
Email=abc@abc.com
CHECKURL="http://icanhazip.com/"

date
UPDATE=0
if (echo $CHECKURL |grep -q "://")
then
	IPREX='([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])'
	URLIP=$(curl $(if [ -n "$OUT" ]; then echo "--interface $OUT"; fi) -s $CHECKURL|grep -Eo "$IPREX"|tail -n1)
	echo "[URL IP]:$URLIP"
	dnscmd="nslookup";type nslookup >/dev/null 2>&1||dnscmd="ping -c1"
	DNSTEST=$($dnscmd $host.$domain)
		if [ "$?" == 0 ]
		then
			DNSIP=$(echo $DNSTEST|grep -Eo "$IPREX"|tail -n1)
			else DNSIP="Get $domain DNS Failed."
		fi
		echo "[DNS IP]:$DNSIP"
		if [ "$DNSIP" == "$URLIP" ]
		then
			echo "IP SAME IN DNS,SKIP UPDATE."
			exit
		fi
fi
token="login_token=${API_ID},${API_Token}&format=json&lang=en&error_on_empty=yes&domain=${domain}&sub_domain=${host}"
UA="User-Agent: tanst DDNS Client/1.0.0 ($Email)"
Record="$(curl $(if [ -n "$OUT" ]; then echo "--interface $OUT"; fi) -s -X POST https://dnsapi.cn/Record.List -d "${token}" -H "${UA}")"
iferr="$(echo ${Record#*code}|cut -d'"' -f3)"
if [ "$iferr" == "1" ]
then
	record_ip=$(echo ${Record#*value}|cut -d'"' -f3)
	echo "[API IP]:$record_ip"
		if [ "$record_ip" == "$URLIP" ]
		then
			echo "IP SAME IN API,SKIP UPDATE."
			exit
		fi
	record_id=$(echo ${Record#*records}|cut -d'"' -f9)
	record_line_id=$(echo ${Record#*line_id}|cut -d'"' -f3)
	echo Start DDNS update...
	ddns="$(curl $(if [ -n "$OUT" ]; then echo "--interface $OUT"; fi) -s -X POST https://dnsapi.cn/Record.Ddns -d "${token}&record_id=${record_id}&record_line_id=${record_line_id}" -H "${UA}")"
	ddns_result="$(echo ${ddns#*message\"}|cut -d'"' -f2)"
	final_IP=$(echo $ddns|grep -Eo "$IPREX"|tail -n1)
	echo "DDNS upadte result:$ddns_result $final_IP"
	UPDATE=1
	else echo -n Get $host.$domain error :
	echo $(echo ${Record#*message\"})|cut -d'"' -f2
fi


# IP CHECK

IP_CONF='ip.conf'
current_ip=$URLIP


if [ ! -d $IP_CONF ]
then
    touch $IP_CONF
fi

conf_ip=$(cat $IP_CONF)

if [ "$conf_ip" != "$current_ip" ] || [ $UPDATE == 1 ]
then
	curl -k https://www.xdty.org/mail/mail.php -X POST -d "event=RECORD_IP($final_IP),CURRENT_IP:$current_ip changed&name=$host.$domain&email=$Email"
	echo "$current_ip">$IP_CONF
	echo "Email is sent successfully."
fi
