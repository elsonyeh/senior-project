FROM node:20-alpine

WORKDIR /app

# 複製 package 文件
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製所有源代碼
COPY . .

# 暴露端口
EXPOSE 4001

# 啟動命令
CMD ["npm", "start"]
