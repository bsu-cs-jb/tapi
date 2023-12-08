# tapi

## AWS Info

- Name: Test Stuff
- IP: 44.220.47.146
- instanceId: i-02c89d1fcd5c3d7d8
- t4g.nano

## Running

SSH to server

```bash
ssh -i cs411_ec2.pem ec2-user@cs411.duckdns.org
```

tmux is running

```bash
tmux a
sudo yarn serve:watch
```

```bash
# Create user
curl -i -X POST http://localhost:3000/indecisive/users -H "Content-Type: application/json" -d @./db/test/user-jemaine.json
# Create session
curl -i -X POST http://localhost:3000/indecisive/sessions -H "Content-Type: application/json" -d @./db/test/session-new.json
```

## Koa and koa-router

[TypeScript koa boilerplate](https://github.com/kryz81/koa-ts-boilerplate/blob/master/package.json)

[Node TypeScript Koa REST](https://github.com/javieraviles/node-typescript-koa-rest/blob/master/src/server.ts)
- this is older
