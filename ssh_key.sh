#/bin/sh

###################################
#    bash <(curl -Lso- https://raw.githubusercontent.com/tanst/scripts/master/ssh_key.sh)
###################################

echo "PS1='\[\e[1;32;40m\][\u@\h:\t \W]\$ \[\e[0m\]'" >> ~/.bashrc
echo "alias ll='ls --color=auto -l'" >> ~/.bashrc
echo "alias ls='ls --color=auto'" >> ~/.bashrc
mkdir ~/.ssh
curl -s https://github.com/tanst.keys > ~/.ssh/authorized_keys
chmod 700 ~/.ssh/authorized_keys
chmod 600 ~/.ssh
sed -i "/PasswordAuthentication no/c PasswordAuthentication no" /etc/ssh/sshd_config
sed -i "/PasswordAuthentication yes/c PasswordAuthentication no" /etc/ssh/sshd_config
sed -i "/PubkeyAuthentication no/c PubkeyAuthentication yes" /etc/ssh/sshd_config
sed -i "/PubkeyAuthentication yes/c PubkeyAuthentication yes" /etc/ssh/sshd_config
sed -i "/PrintMotd no/c PrintMotd yes" /etc/ssh/sshd_config
sed -i "/PrintMotd yes/c PrintMotd yes" /etc/ssh/sshd_config
sed -i "/PrintLastLog no/c PrintLastLog yes" /etc/ssh/sshd_config
sed -i "/PrintLastLog yes/c PrintLastLog yes" /etc/ssh/sshd_config
sed -i "/Port.*/c Port 43389" /etc/ssh/sshd_config
service sshd restart
systemctl restart sshd
echo -e "Please enter \033[0;35msource ~/.bashrc\033[0m for immediate effect"
