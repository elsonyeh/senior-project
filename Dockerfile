FROM node:20-alpine

WORKDIR /app

# 複製 server 目錄
COPY server/package*.json ./server/
COPY server/ ./server/

# 安裝依賴
RUN npm install --prefix server

# 暴露端口（Railway 會自動設置 PORT 環境變量）
EXPOSE 4001

# 啟動命令
CMD ["npm", "start", "--prefix", "server"]
