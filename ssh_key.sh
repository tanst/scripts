#/bin/sh

echo -e "\033[0;33m============================\033[0m"
echo -e "\033[0;32mbash <(curl -Lso- https://raw.githubusercontent.com/tanst/scripts/master/ssh_key.sh)\033[0m"
echo -e "\033[0;33m============================\033[0m"

cd ~
echo "PS1='\[\e[1;32;40m\][\u@\h:\t \W]\$ \[\e[0m\]'" >> ~/.bashrc && source ~/.bashrc
mkdir .ssh
cd .ssh
curl https://github.com/tanst.keys > authorized_keys
chmod 700 authorized_keys
cd ../
chmod 600 .ssh
cd /etc/ssh/
sed -i "/PasswordAuthentication no/c PasswordAuthentication no" sshd_config
sed -i "/PasswordAuthentication yes/c PasswordAuthentication no" sshd_config
sed -i "/PubkeyAuthentication no/c PubkeyAuthentication yes" sshd_config
sed -i "/PubkeyAuthentication yes/c PubkeyAuthentication yes" sshd_config
sed -i "/PrintMotd no/c PrintMotd yes" sshd_config
sed -i "/PrintMotd yes/c PrintMotd yes" sshd_config
sed -i "/PrintLastLog no/c PrintLastLog yes" sshd_config
sed -i "/PrintLastLog yes/c PrintLastLog yes" sshd_config
#sed -i "/Port.*/c Port 8888" sshd_config
service sshd restart
service ssh restart
systemctl restart sshd
systemctl restart ssh
cd ~
