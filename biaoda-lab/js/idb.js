/**
 * IDBAudio — 录音音频 IndexedDB 存储模块
 *
 * 背景：localStorage 只能存字符串且容量小（~5MB），录音 Blob 无法直接保存；
 *      之前用 URL.createObjectURL 生成的 blob: 链接在页面刷新后全部失效，
 *      导致「播放录音」永远无法播放。
 *
 * 方案：录音 Blob 存入 IndexedDB（容量数百 MB、可存二进制、持久化），
 *      记录里 audio_ref 存 'idb:<key>'，播放时异步取回 Blob 再临时创建播放链接。
 *
 * 全局暴露：window.IDBAudio
 */
(function () {
  'use strict';

  const DB_NAME = 'biaoda_lab_audio';
  const DB_VERSION = 1;
  const STORE = 'recordings';

  let _dbPromise = null;

  /** 打开（单例）数据库连接 */
  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('当前浏览器不支持 IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    });
    return _dbPromise;
  }

  /** 保存录音 Blob；key 建议使用 record.id */
  async function save(key, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, String(key));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('录音保存失败'));
    });
  }

  /** 读取录音 Blob；不存在返回 null */
  async function get(key) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(String(key));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('录音读取失败'));
      });
    } catch {
      return null;
    }
  }

  /** 删除录音 */
  async function remove(key) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(String(key));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('录音删除失败'));
      });
    } catch {
      return false;
    }
  }

  /** 从 audio_ref 值（'idb:<key>'）解析 key；非 idb 引用返回 null */
  function keyFromRef(ref) {
    if (typeof ref === 'string' && ref.startsWith('idb:')) {
      return ref.slice(4);
    }
    return null;
  }

  window.IDBAudio = { save, get, remove, keyFromRef };
})();
