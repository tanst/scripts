#!/bin/sh

###################################
#    bash <(curl -Lso- https://raw.githubusercontent.com/tanst/scripts/master/ssh_key.sh)
###################################
apt-get update -y
apt-get install curl -y
echo "PS1='\[\e[1;33m\]\u\[\e[1;31m\]@\[\e[1;35m\]\h\[\e[1;32m\][\t]\[\e[1;31m\]:\[\e[1;36m\]\w\[\e[1;34m\]\$\[\e[0;39m\] '" >> ~/.bashrc
echo "alias ll='ls --color=auto -l'" >> ~/.bashrc
echo "alias ls='ls --color=auto'" >> ~/.bashrc
mkdir -p ~/.ssh
curl -s https://github.com/tanst.keys > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/g' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/g' /etc/ssh/sshd_config
sed -i 's/^#\?PrintMotd.*/PrintMotd yes/g' /etc/ssh/sshd_config
sed -i 's/^#\?PrintLastLog.*/PrintLastLog yes/g' /etc/ssh/sshd_config
sed -i 's/^#\?Port.*/Port 43389/g' /etc/ssh/sshd_config
systemctl restart ssh
echo -e "Please enter \033[0;35msource ~/.bashrc\033[0m for immediate effect"
