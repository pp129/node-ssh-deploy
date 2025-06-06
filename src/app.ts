import * as fs from "fs-extra";
import * as archiver from "archiver";
import * as winston from "winston";
import * as yargs from "yargs";
import * as ora from "ora";
import * as path from "path";
import { Client } from "ssh2";
import type { IServer } from "./interfaces/server";

function getFilePath(filename) {
  return path.join("./", filename);
}

const argv = yargs
  .usage("Usage: $0 [options]")
  .alias("f", "file")
  .describe("file", "JSON Configuration File")
  .demandOption("file").argv;

winston.debug(`Start`, argv);

const jsonFile: IServer = fs.readJsonSync(argv.file);
// loading
const spinner = {
  network: ora("正在监测网络..."),
  deploy: ora("正在发布到服务器..."),
  connect: ora("正在建立连接..."),
  remove: ora("正在删除旧文件..."),
  copy: ora("正在备份文件.."),
  zip: ora("正在压缩文件.."),
  unzip: ora("正在解压文件.."),
};

/**
 * 压缩文件
 * @param url
 * @param filename
 * @param cb
 * @returns {Promise<void>}
 */
async function zip(url, filename, cb) {
  // init
  const output = fs.createWriteStream(`${filename}.zip`); //创建数据流
  output.on("close", () => cb("finish")); //创建完成
  // zip
  const archive = archiver("zip", { zlib: { level: 9 } }); //设置压缩格式和等级
  archive.on("error", (err) => cb(err));
  archive.pipe(output);
  if (fs.statSync(url).isFile())
    archive.file(url, { name: path.basename(url) });
  // 文件
  else archive.directory(url, filename, null);
  await archive.finalize();
}

// 创建连接方法
const conn = new Client();

/**
 * shell执行函数
 * @param c
 * @returns {function(*): Promise<unknown>}
 */
function execFn(c = conn) {
  return (command) => {
    console.log(command);
    return new Promise((resolve, reject) => {
      c.exec(command, (err, stream) => {
        if (err) {
          console.log(err);
          reject(err);
          return;
        }
        let result = "";
        stream
          .on("close", () => {
            resolve(String(result));
          })
          .on("data", (data) => {
            //data数据是Buffer类型，需要转化成字符串
            result += data;
          });
      });
    });
  };
}

function putFile(sftp, exec, path, file, outputDir) {
  sftp.fastPut(file, `${path}/${outputDir}.zip`, async function (err) {
    if (err) throw err;
    spinner.deploy.stop();
    console.log("✅ 已上传");

    // 解压
    spinner.unzip.start();
    await exec(
      `cd ${path} && unzip -o -q ${outputDir}.zip && rm -rf ${outputDir}.zip`
    );
    spinner.unzip.stop();
    console.log("✅ 已解压并删除zip文件");
    console.log("🎉 项目发布完毕");
    conn.end();
  });
}

// 备份日期
const date =
  new Date().toLocaleDateString("zh", { hour12: false }).replaceAll("/", "") +
  new Date().toLocaleTimeString("zh", { hour12: false }).replaceAll(":", "");

app().catch((err: Error) => {
  winston.error(err.message);
});

function checkJsonFile(jsonFile: IServer) {
  if (!jsonFile.outputDir) {
    const outputDir = getFilePath("dist");
    try {
      fs.statSync(outputDir).isFile();
    } catch (err) {
      throw new Error(`${err} -- 请配置正确的outputDir，或检查是否打包成功`);
    }
  } else {
    const outputDir = getFilePath(jsonFile.outputDir);
    try {
      fs.statSync(outputDir).isFile();
    } catch (err) {
      throw new Error(`${err} -- 请配置正确的outputDir，或检查是否打包成功`);
    }
  }
  if (!jsonFile.dest) {
    throw new Error("请配置服务器信息");
  } else {
    const { host, username, password, privateKey, path } = jsonFile.dest;
    if (!host) {
      throw new Error("请配置服务器host");
    }
    if (!username) {
      throw new Error("请配置服务器username");
    }
    if (!password && !privateKey) {
      throw new Error("请配置服务器password或密钥");
    }
    if (!path) {
      throw new Error("请配置服务器path");
    }
  }
}

async function app() {
  checkJsonFile(jsonFile);

  const outputDir = jsonFile.outputDir ?? "dist";
  const dest = jsonFile.dest;

  // 开始压缩
  spinner.zip.start();

  zip(getFilePath(outputDir), outputDir, () => {
    spinner.zip.stop();
    console.log(`✅ 已压缩`);
  }).then(() => {
    const localFile = getFilePath(`${outputDir}.zip`);
    console.log(localFile);
    const { host, port, username, password, path, privateKey } = dest;
    spinner.connect.start();
    conn
      .on("ready", async function () {
        spinner.connect.stop();
        console.log(`✅ 已连接${host}:${port ?? 22}`);
        const exec = execFn(conn);

        // 删除旧文件夹
        spinner.remove.start();
        await exec(`rm -rf ${path}/${outputDir}_*`);
        spinner.remove.stop();
        console.log("✅ 已删除旧备份");

        // 服务器dist文件夹备份
        const backup = `${path}/${outputDir}_${date}`;
        spinner.copy.start();
        await exec(`mv ${path}/${outputDir} ${backup}`);
        spinner.copy.stop();
        console.log(`✅ 已备份至${backup}`);

        // 上传新zip文件
        spinner.deploy.start();
        conn.sftp(function (err, sftp) {
          if (err) throw err;

          // linux 是否存在目录${path}，没有就创建
          sftp.exists(path, (exists) => {
            if (!exists) {
              sftp.mkdir(path, function (err) {
                if (err) throw err;
                console.log(`✅ 已创建目录${path}`);
                putFile(sftp, exec, path, localFile, outputDir);
              });
            } else {
              putFile(sftp, exec, path, localFile, outputDir);
            }
          });
        });
      })
      .connect({
        host,
        port: port ?? 22,
        username,
        password,
        privateKey: privateKey ? fs.readFileSync(privateKey) : "", // 使用密钥登录
      }); // 连接服务器
  });
}
