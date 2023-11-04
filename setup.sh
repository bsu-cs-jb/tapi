
yum update -y

# https://github.com/cli/cli/blob/trunk/docs/install_linux.md
type -p yum-config-manager >/dev/null || yum install yum-utils
yum-config-manager --add-repo https://cli.github.com/packages/rpm/gh-cli.repo

yum install -y tmux cronie git gh

# Node

yum install -y nodejs

npm install --global yarn

# React Native

# yum install java-11-amazon-corretto-headless

# yum install -y \
#   python3.11 \
#   python3.11-pip \
#   python3.11-pip-wheel \
#   python3.11-setuptools
#
# rm -f /usr/bin/python /usr/bin/python3
#
# ln -s /usr/bin/python3.11 /usr/bin/python
# ln -s /usr/bin/python3.11 /usr/bin/python3
#
# rm -f /usr/bin/pip /usr/bin/pip3
#
# ln -s /usr/bin/pip3.11 /usr/bin/pip
# ln -s /usr/bin/pip3.11 /usr/bin/pip3
