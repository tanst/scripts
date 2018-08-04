#!/bin/sh

# personal config
API_ID=12345
API_Token=000000000000000000000
SUBDOMAIN=ddns
DOMAIN=abc.com
Email=abc@abc.com
CHECKURL=http://icanhazip.com/

# system config
DNSPOD_TOKEN="login_token=${API_ID},${API_Token}"
UPDATE_STATUS=0

# function
dnspod_send_email(){

	IP_CONF='./ip.conf'
	if [ ! -d $IP_CONF ]
	then
		touch $IP_CONF
	fi
	CONF_IP=$(cat $IP_CONF)
	
	if [ "$CONF_IP" != "$CURRENT_IP" ] || [ $UPDATE_STATUS == 1 ]
	then
		curl -k https://www.xdty.org/mail/mail.php -X POST -d "event=CURRENT_IP:$CURRENT_IP changed&name=$SUBDOMAIN.$DOMAIN&email=$Email"
		echo "$CURRENT_IP">$IP_CONF
		echo "Email is sent successfully."
	else
		echo "IP NO CHANGED"
	fi
	exit
}


# dnspod_ip_check

## DNS_IP = CURRENT_IP
	IPREX='([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.([0-9]{1,2}|1[0-9][0-9]|2[0-4][0-9]|25[0-5])'
	CURRENT_IP=$(curl -s $CHECKURL|grep -Eo "$IPREX"|tail -n1)
	echo "CURRENT_IP:$CURRENT_IP"

	DNSCMD="nslookup";type nslookup >/dev/null 2>&1||DNSCMD="ping -c1"
	DNSTEST=$($DNSCMD $SUBDOMAIN.$DOMAIN)
	if [ "$?" == 0 ]
	then DNS_IP=$(echo $DNSTEST|grep -Eo "$IPREX"|tail -n1)
	else DNS_IP="Get $domain DNS Failed."
	fi
	echo "DNS_IP:$DNS_IP"

	if [ "$DNS_IP" == "$CURRENT_IP" ]
	then
		echo "DNS_IP = CURRENT_IP , SKIP UPDATE."
		dnspod_send_email
	fi

## RECORD_IP = CURRENT_IP

	Record_List="$(curl -s -k https://dnsapi.cn/Record.List -d "${DNSPOD_TOKEN}&domain=${DOMAIN}&sub_domain=${SUBDOMAIN}")"

    for line in $Record_List;do
        if [ $(echo $line|grep '<value>' |wc -l) != 0 ];then
            RECORD_IP=${line%<*};
            RECORD_IP=${RECORD_IP#*>};
            #echo "RECORD_IP: $RECORD_IP";
        fi
        if [ $(echo $line|grep '<id>' |wc -l) != 0 ];then
            RECORD_ID=${line%<*};
            RECORD_ID=${RECORD_ID#*>};
            #echo "RECORD_ID: $RECORD_ID";
        fi
        if [ $(echo $line|grep '<line_id>' |wc -l) != 0 ];then
            LINE_ID=${line%<*};
            LINE_ID=${LINE_ID#*>};
            #echo "LINE_ID: $LINE_ID";
        fi
        if [ $(echo $line|grep '<code>' |wc -l) != 0 ];then
            STATUS_CODE=${line%<*};
            STATUS_CODE=${STATUS_CODE#*>};
            #echo "STATUS_CODE: $STATUS_CODE";
        fi
    done

if [ "$STATUS_CODE" != "1" ]
then echo "Error:Get DNSPOD API Error!";exit
fi

	echo "RECORD_IP:$RECORD_IP"

	if [ "$RECORD_IP" == "$CURRENT_IP" ]
	then
		echo "RECORD_IP = CURRENT_IP , SKIP UPDATE."
		dnspod_send_email
	fi

# dnspod_update

echo Start DDNS update...

Record_Ddns="$(curl $(if [ -n "$OUT" ]; then echo "--interface $OUT"; fi) -s -X POST https://dnsapi.cn/Record.Ddns -d "${DNSPOD_TOKEN}&record_id=${RECORD_ID}&record_line_id=${LINE_ID}&domain=${DOMAIN}&sub_domain=${SUBDOMAIN}")"

for line in $Record_Ddns;do
    if [ $(echo $line|grep '<message>' |wc -l) != 0 ];then
        DDNS_RESULT=${line%<*};
        DDNS_RESULT=${DDNS_RESULT#*>};
        echo "DDNS_RESULT: $DDNS_RESULT";
    fi
done
UPDATE_STATUS=1
