# Node SSH Deployer

基于[SSH-Deployer](https://github.com/barend-erasmus/ssh-deployer/tree/master) 修改的一键部署工具。

```bash
Usage: ssh-deployer [options]

Options:
  -f, --file  JSON Configuration File       [required]
```

## Getting Started

### 安装

```bash
npm install node-ssh-deploy
```

### 配置文件

在项目根目录下创建一个配置文件，例如 'deploy.json'，内容如下：

```json
{
  "outDir": "",
  "dest": {
    "host": "",
    "port": "",
    "username": "",
    "password": "",
    "path": ""
  }
}
```

- `outDir`：本地项目打包后的目录，默认为 `dist`。
- `dest`：远程服务器的配置信息。
  - `host`：远程服务器地址。
  - `port`：远程服务器端口，默认为 `22`。
  - `username`：远程服务器用户名。
  - `password`：远程服务器密码。
  - `path`：远程服务器部署路径。

### 运行

```bash
ssh-deployer --file "deploy.json"
```

或在项目 package.json 中添加脚本：

```json
"scripts": {
  "deploy": "ssh-deployer -f deploy.json"
}
```

然后运行 `npm run deploy`
