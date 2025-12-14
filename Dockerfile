FROM node:20-alpine

WORKDIR /app

# 複製整個 server 目錄
COPY server ./server

# 安裝依賴
WORKDIR /app/server
RUN npm install

# 暴露端口（Railway 會自動設置 PORT 環境變量）
EXPOSE 4001

# 啟動命令
WORKDIR /app/server
CMD ["npm", "start"]
