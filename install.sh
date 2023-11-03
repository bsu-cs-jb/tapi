
host="$1"

scp -i cs411_ec2.pem ./setup.sh ec2-user@${host}:/home/ec2-user/
scp -i cs411_ec2.pem ./duck.sh ec2-user@${host}:/home/ec2-user/

# crontab -e
# */5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1


