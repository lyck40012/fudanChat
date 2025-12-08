import axios from 'axios';
import { message } from 'antd';

// 创建 axios 实例
const service = axios.create({
  baseURL: process.env.REACT_APP_BASE_API, // api 的 base_url
  timeout: 5000 // 请求超时时间
});

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 在发送请求之前做些什么
    // 比如，可以在这里添加 token
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers['Authorization'] = 'Bearer ' + token;
    // }
    return config;
  },
  error => {
    // 对请求错误做些什么
    console.log(error); // for debug
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data;
    // 对响应数据做点什么
    // 如果返回的状态码不是 200，则判断为错误。
    if (res.code !== 200) {
      message.error(res.message || 'Error');
      return Promise.reject(new Error(res.message || 'Error'));
    } else {
      return res;
    }
  },
  error => {
    // 对响应错误做点什么
    console.log('err' + error); // for debug
    message.error(error.message);
    return Promise.reject(error);
  }
);

// 通用请求方法
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: any; // GET 请求的查询参数
  data?: any; // POST/PUT/PATCH 请求的请求体数据
}

/**
 * 通用请求方法
 * @param options 请求配置
 * @returns Promise
 */
export const request = async <T = any>(options: RequestOptions): Promise<T> => {
  const { url, method = 'GET', params, data } = options;

  try {
    const response = await service({
      url,
      method,
      params, // GET 请求参数
      data // POST/PUT/PATCH 请求体
    });
    return response.data;
  } catch (error) {
    return Promise.reject(error);
  }
};

export default service;
