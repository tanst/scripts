#!/bin/sh

#====================================================
#    bash <(curl -Lso- https://raw.githubusercontent.com/tanst/scripts/master/Docker/Install_Docker.sh)
#====================================================

#Install docker
if which docker >/dev/null; then
    echo "Docker has been installed, skip the installation steps"
    docker -v
    echo "Start Docker "
    service docker start
else
    echo "Start installing Docker"
    curl -fsSL get.docker.com | sudo sh && docker -v
    echo "Start Docker"
    systemctl enable docker && systemctl start docker
fi

##Install Latest Stable Docker Compose Release
if which docker-compose >/dev/null; then
    echo "docker-compose has been installed, skip the installation steps"
    docker-compose -v
else
    echo "Start installing docker-compose "
    curl -L "https://github.com/docker/compose/releases/download/1.26.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose \
    && chmod +x /usr/local/bin/docker-compose
    if which docker-compose >/dev/null; then
        echo "docker-compose installed successfully"
        docker-compose -v
    else
        ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
        echo "docker-compose installed successfully"
        docker-compose -v
    fi

fi
