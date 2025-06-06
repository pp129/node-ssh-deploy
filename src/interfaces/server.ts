interface IDest {
  /**
   * 服务器ip
   */
  host: string;
  /**
   * 端口一般默认22
   */
  port: number | string;
  /**
   * 服务器用户名
   */
  username: string;
  /**
   * 服务器连接密码
   */
  password?: string;
  /**
   * 上传到服务器的位置
   */
  path: string;
  /**
   * 服务器连接密钥
   */
  privateKey?: string;
}

export interface IServer {
  /**
   * 本地打包文件路径
   */
  outputDir: string;
  dest: IDest;
}
