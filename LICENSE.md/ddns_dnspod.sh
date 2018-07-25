#!/bin/sh

dnspod_load_config(){
	API_ID=xxx
	API_Token=xxx
	SUBDOMAIN=www
	DOMAIN=abc.com
	RECORD_LINE="默认"
	Email=admin@adc.com
	CHECKURL="http://icanhazip.com/"
}

dnspod_ip_check(){
	IPREX='([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])'
	
	#current_ip
	current_ip=$(curl $(if [ -n "$OUT" ]; then echo "--interface $OUT"; fi) -s $CHECKURL|grep -Eo "$IPREX"|tail -n1)
	echo "[current IP]:$current_ip"
	
	#resolve_ip
    resolve_ip=$(curl -s http://119.29.29.29/d?dn=$SUBDOMAIN.$DOMAIN)
	echo "[resolve IP]:$resolve_ip"
	
	if [ "$resolve_ip" = "$current_ip" ]; then
    echo "IP SAME IN resolve IP,SKIP UPDATE."
    exit 0;
    fi

	#DNS_IP
	# dnscmd="nslookup";type nslookup >/dev/null 2>&1||dnscmd="ping -c1"
	# DNSTEST=$($dnscmd $SUBDOMAIN.$DOMAIN)
	# if [ "$?" == 0 ];then
	# DNSIP=$(echo $DNSTEST|grep -Eo "$IPREX"|tail -n1)
	# else DNSIP="Get $domain DNS Failed."
	# fi
	# echo "[DNS IP]:$DNSIP"

	# if [ "$DNSIP" = "$current_ip" ]; then
    # echo "IP SAME IN DNSIP,SKIP UPDATE."
    # exit 0;
    # fi
}


dnspod_domain_get_id(){
	echo Start DDNS update...
	token="login_token=${API_ID},${API_Token}";
	out=$(curl -s -k https://dnsapi.cn/Domain.List -d ${token});
    for line in $out;do
        if [ $(echo $line|grep '<id>' |wc -l) != 0 ];then
            DOMAIN_ID=${line%<*};
            DOMAIN_ID=${DOMAIN_ID#*>};
            #echo "domain id: $DOMAIN_ID";
        fi
        if [ $(echo $line|grep '<name>' |wc -l) != 0 ];then
            DOMAIN_NAME=${line%<*};
            DOMAIN_NAME=${DOMAIN_NAME#*>};
            #echo "domain name: $DOMAIN_NAME";
            if [ "$DOMAIN_NAME" = "$DOMAIN" ];then
               break;
            fi
        fi
    done
	out=$(curl -s -k https://dnsapi.cn/Record.List -d "${token}&domain_id=${DOMAIN_ID}")
    for line in $out;do
        if [ $(echo $line|grep '<id>' |wc -l) != 0 ];then
            RECORD_ID=${line%<*};
            RECORD_ID=${RECORD_ID#*>};
            #echo "record id: $RECORD_ID";
        fi
        if [ $(echo $line|grep '<name>' |wc -l) != 0 ];then
            RECORD_NAME=${line%<*};
            RECORD_NAME=${RECORD_NAME#*>};
            #echo "record name: $RECORD_NAME";
            if [ "$RECORD_NAME" = "$SUBDOMAIN" ];then
               break;
            fi
        fi
    done
    echo "record name: $RECORD_NAME"
	echo "record id: $RECORD_ID"
}

dnspod_update_record_ip(){
	DDNS="$(curl -k https://dnsapi.cn/Record.Ddns -d "login_token=${API_ID},${API_Token}&domain_id=${DOMAIN_ID}&record_id=${RECORD_ID}&sub_domain=${RECORD_NAME}&record_line=${RECORD_LINE}")"
	curl -k https://www.xdty.org/mail/mail.php -X POST -d "event=ip($current_ip) changed&name=$SUBDOMAIN.$DOMAIN&email=$Email"
	
	UA="User-Agent: tanst DDNS Client/1.0.0 ($Email)"
	Record="$(curl -s -X POST https://dnsapi.cn/Record.List -d "${token}&format=json&lang=en&error_on_empty=yes&domain=${DOMAIN}&sub_domain=${SUBDOMAIN}" -H "${UA}")"
	iferr="$(echo ${Record#*code}|cut -d'"' -f3)"
	if [ "$iferr" == "1" ];then
	record_ip=$(echo ${Record#*value}|cut -d'"' -f3)
	echo "Action completed successful:$record_ip"
	fi
}

main(){

	dnspod_load_config $1
	dnspod_ip_check
	dnspod_domain_get_id
	dnspod_update_record_ip
}

main $1
