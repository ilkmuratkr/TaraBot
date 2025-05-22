"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerConnection = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config"); // config dosyasını import et
exports.redisClient = new ioredis_1.default(config_1.config.redis.url);
// Worker için kullanılacak özel bağlantı da burada tanımlanabilir veya server.ts'de kalabilir.
// Şimdilik sadece ana redisClient'ı buraya taşıyoruz.
exports.workerConnection = new ioredis_1.default(config_1.config.redis.url, {
    maxRetriesPerRequest: null,
});
exports.redisClient.on('connect', () => {
    console.log('Ana Redis client bağlandı.');
});
exports.redisClient.on('error', (err) => {
    console.error('Ana Redis client hatası:', err);
});
exports.workerConnection.on('connect', () => {
    console.log('Worker Redis bağlantısı bağlandı.');
});
exports.workerConnection.on('error', (err) => {
    console.error('Worker Redis bağlantı hatası:', err);
});
//# sourceMappingURL=redisClient.js.map