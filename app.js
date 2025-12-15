// ==================== 数据存储模块 ====================
class Storage {
    static STORAGE_KEY = 'vocabApp_words';
    static PRACTICE_LOG_KEY = 'vocabApp_practiceLog';
    static SENTENCE_KEY = 'vocabApp_sentences';
    static SENTENCE_LOG_KEY = 'vocabApp_sentencePracticeLog';
    
    // 初始化：从localStorage迁移数据到chrome.storage.sync
    static async initialize() {
        const statusEl = document.getElementById('sync-status');
        
        // 检测浏览器同步存储是否可用（需要实际测试写入）
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            // 尝试写入测试数据来验证同步存储是否真正可用
            try {
                await new Promise((resolve, reject) => {
                    chrome.storage.sync.set({ '__test__': 'test' }, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            chrome.storage.sync.remove('__test__', () => {
                                resolve();
                            });
                        }
                    });
                });
                
                console.log('✓ 浏览器同步存储可用 - 数据将自动同步到云端');
                
                if (statusEl) {
                    statusEl.textContent = '☁️ 浏览器同步已启用 - 数据将自动同步';
                    statusEl.className = 'sync-status success';
                    statusEl.style.display = 'block';
                    setTimeout(() => {
                        statusEl.style.display = 'none';
                    }, 5000);
                }
                
                // 检查是否需要从localStorage迁移数据
                const localWords = localStorage.getItem(this.STORAGE_KEY);
                const localLog = localStorage.getItem(this.PRACTICE_LOG_KEY);
                
                if (localWords || localLog) {
                    return new Promise((resolve) => {
                        // 从chrome.storage.sync读取
                        chrome.storage.sync.get([this.STORAGE_KEY, this.PRACTICE_LOG_KEY], (syncData) => {
                            // 如果云端没有数据，迁移本地数据
                            if (!syncData[this.STORAGE_KEY] && localWords) {
                                chrome.storage.sync.set({ [this.STORAGE_KEY]: localWords });
                                console.log('✓ 单词数据已迁移到云端');
                            }
                            if (!syncData[this.PRACTICE_LOG_KEY] && localLog) {
                                chrome.storage.sync.set({ [this.PRACTICE_LOG_KEY]: localLog });
                                console.log('✓ 练习日志已迁移到云端');
                            }
                            resolve();
                        });
                    });
                }
            } catch (error) {
                // 同步存储不可用，降级到本地存储
                console.warn('⚠ 浏览器同步存储不可用:', error.message || error);
                this._showLocalStorageWarning(statusEl, error);
            }
        } else {
            console.log('ℹ 使用本地存储 - 数据不会同步');
            this._showLocalStorageWarning(statusEl);
        }
    }
    
    // 显示本地存储警告
    static _showLocalStorageWarning(statusEl, error = null) {
        if (statusEl) {
            let message = 'ℹ️ 本地存储模式';
            
            if (error) {
                // 根据错误信息提供具体原因
                const errorMsg = error.message || String(error);
                if (errorMsg.includes('MAX_WRITE_OPERATIONS')) {
                    message += ' - 超出同步存储写入限制';
                } else if (errorMsg.includes('QUOTA_BYTES')) {
                    message += ' - 同步存储空间已满';
                } else if (errorMsg.includes('access')) {
                    message += ' - 同步存储访问被拒绝';
                } else {
                    message += ` - ${errorMsg}`;
                }
            } else {
                message += ' - 请使用Chrome/Edge并登录账号以启用同步';
            }
            
            statusEl.textContent = message;
            statusEl.className = 'sync-status warning';
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 8000); // 延长显示时间到8秒，便于用户看清原因
        }
    }

    // 获取数据（优先使用chrome.storage.sync）
    static getData(key) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get([key], (result) => {
                    if (chrome.runtime.lastError) {
                        // 如果同步存储出错，降级到localStorage
                        console.warn('同步存储读取失败，使用本地存储:', chrome.runtime.lastError);
                        resolve(localStorage.getItem(key));
                    } else {
                        resolve(result[key] || localStorage.getItem(key));
                    }
                });
            } else {
                resolve(localStorage.getItem(key));
            }
        });
    }

    // 保存数据（同时保存到chrome.storage.sync和localStorage）
    static setData(key, value) {
        return new Promise((resolve) => {
            // 先保存到localStorage作为备份
            localStorage.setItem(key, value);
            
            // 尝试保存到chrome.storage.sync
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ [key]: value }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('同步存储保存失败:', chrome.runtime.lastError);
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // 获取所有单词（同步方法）
    static getWords() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        const words = data ? JSON.parse(data) : [];
        
        // 数据迁移：确保每个单词都有必要的字段
        let needsSave = false;
        words.forEach(word => {
            // 确保有 stats 字段
            if (!word.stats) {
                word.stats = {
                    practiceCount: 0,
                    correctCount: 0,
                    errorCount: 0,
                    lastPracticeTime: null
                };
                needsSave = true;
            }
            // 确保有 tags 字段
            if (!word.tags) {
                word.tags = [];
                needsSave = true;
            }
        });
        
        // 如果有更新，保存回去
        if (needsSave) {
            this.saveWords(words);
        }
        
        return words;
    }

    // 保存所有单词（异步同步到云端）
    static saveWords(words) {
        const data = JSON.stringify(words);
        this.setData(this.STORAGE_KEY, data);
    }

    // 获取练习日志
    static getPracticeLog() {
        const data = localStorage.getItem(this.PRACTICE_LOG_KEY);
        return data ? JSON.parse(data) : {};
    }

    // 保存练习日志
    static savePracticeLog(log) {
        const data = JSON.stringify(log);
        this.setData(this.PRACTICE_LOG_KEY, data);
    }

    // 记录今日练习
    static recordTodayPractice(wordId, isCorrect) {
        const log = this.getPracticeLog();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!log[today]) {
            log[today] = {
                wordIds: new Set(),
                correctCount: 0
            };
        } else {
            // 将已有的wordIds数组转换为Set
            log[today].wordIds = new Set(log[today].wordIds || []);
        }
        
        log[today].wordIds.add(wordId);
        if (isCorrect) {
            log[today].correctCount = (log[today].correctCount || 0) + 1;
        }
        
        // 将Set转换回数组以便JSON序列化
        log[today].wordIds = Array.from(log[today].wordIds);
        
        this.savePracticeLog(log);
    }

    // 添加单词
    static addWord(word, meanings, tags = []) {
        const words = this.getWords();
        
        // 生成唯一ID：使用时间戳+随机数确保唯一性
        let id;
        do {
            id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        } while (words.some(w => w.id === id));
        
        const newWord = {
            id: id,
            word: word.toLowerCase().trim(),
            meanings: meanings.map(m => m.trim()),
            tags: tags.map(t => t.trim()).filter(t => t), // 标签数组
            proficiency: -100,
            addedTime: new Date().toISOString(),
            stats: {
                practiceCount: 0,
                correctCount: 0,
                errorCount: 0,
                lastPracticeTime: null
            }
        };
        words.push(newWord);
        this.saveWords(words);
        return newWord;
    }

    // 更新单词
    static updateWord(id, updates) {
        const words = this.getWords();
        const index = words.findIndex(w => w.id === id);
        if (index !== -1) {
            words[index] = { ...words[index], ...updates };
            this.saveWords(words);
            return words[index];
        }
        return null;
    }

    // 删除单词
    static deleteWord(id) {
        const words = this.getWords();
        const filtered = words.filter(w => w.id !== id);
        this.saveWords(filtered);
    }

    // 获取单词通过ID
    static getWordById(id) {
        const words = this.getWords();
        return words.find(w => w.id === id);
    }

    // 获取熟练度最低的N个单词
    static getLowestProficiencyWords(n = 20) {
        const words = this.getWords();
        return words
            .sort((a, b) => a.proficiency - b.proficiency)
            .slice(0, n);
    }

    // 获取熟练度在指定区间内的单词
    static getWordsByProficiencyRange(minProficiency, maxProficiency) {
        const words = this.getWords();
        return words.filter(w => w.proficiency >= minProficiency && w.proficiency <= maxProficiency);
    }

    // 获取今日新增的单词
    static getTodayNewWords() {
        const words = this.getWords();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return words.filter(w => {
            const addedDate = new Date(w.addedTime);
            addedDate.setHours(0, 0, 0, 0);
            return addedDate.getTime() === today.getTime();
        });
    }

    // 从云端同步数据到本地
    static async syncFromCloud() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.get([this.STORAGE_KEY, this.PRACTICE_LOG_KEY], (result) => {
                    if (result[this.STORAGE_KEY]) {
                        localStorage.setItem(this.STORAGE_KEY, result[this.STORAGE_KEY]);
                    }
                    if (result[this.PRACTICE_LOG_KEY]) {
                        localStorage.setItem(this.PRACTICE_LOG_KEY, result[this.PRACTICE_LOG_KEY]);
                    }
                    resolve();
                });
            });
        }
    }

    // 获取所有标签
    static getAllTags() {
        const words = this.getWords();
        const tagsSet = new Set();
        words.forEach(word => {
            if (word.tags && Array.isArray(word.tags)) {
                word.tags.forEach(tag => tagsSet.add(tag));
            }
        });
        return Array.from(tagsSet).sort();
    }

    // 为单词添加标签
    static addTagToWord(wordId, tag) {
        const word = this.getWordById(wordId);
        if (word) {
            if (!word.tags) word.tags = [];
            if (!word.tags.includes(tag)) {
                word.tags.push(tag);
                this.updateWord(wordId, word);
            }
        }
    }

    // 从单词移除标签
    static removeTagFromWord(wordId, tag) {
        const word = this.getWordById(wordId);
        if (word && word.tags) {
            word.tags = word.tags.filter(t => t !== tag);
            this.updateWord(wordId, word);
        }
    }

    // 重命名标签
    static renameTag(oldTag, newTag) {
        const words = this.getWords();
        words.forEach(word => {
            if (word.tags && word.tags.includes(oldTag)) {
                word.tags = word.tags.map(t => t === oldTag ? newTag : t);
            }
        });
        this.saveWords(words);
    }

    // 删除标签（从所有单词中移除）
    static deleteTag(tag) {
        const words = this.getWords();
        words.forEach(word => {
            if (word.tags) {
                word.tags = word.tags.filter(t => t !== tag);
            }
        });
        this.saveWords(words);
    }

    // 按标签筛选单词
    static getWordsByTags(tags) {
        if (!tags || tags.length === 0) {
            return this.getWords();
        }
        const words = this.getWords();
        return words.filter(word => {
            if (!word.tags || word.tags.length === 0) return false;
            // 单词的标签与筛选标签有交集即返回
            return tags.some(tag => word.tags.includes(tag));
        });
    }

    // 从练习日志修复统计数据
    static repairStatsFromLog() {
        const words = this.getWords();
        const practiceLog = this.getPracticeLog();
        let repairedCount = 0;

        // 统计每个单词在日志中出现的次数
        const wordPracticeCount = {};
        Object.values(practiceLog).forEach(dayLog => {
            if (dayLog.wordIds && Array.isArray(dayLog.wordIds)) {
                dayLog.wordIds.forEach(wordId => {
                    wordPracticeCount[wordId] = (wordPracticeCount[wordId] || 0) + 1;
                });
            }
        });

        // 修复统计数据为0但日志中有记录的单词
        words.forEach(word => {
            if (word.stats.practiceCount === 0 && wordPracticeCount[word.id]) {
                // 从日志中推测练习次数
                const logCount = wordPracticeCount[word.id];
                
                // 根据熟练度推测正确率（熟练度变化可以反映练习情况）
                const proficiencyChange = word.proficiency - (-100); // 假设初始是-100
                
                // 简单估算：熟练度每增加1点代表1次正确，每减1点代表1次错误
                // 但练习日志记录的是天数，不是精确次数
                // 保守估计：使用日志天数作为最小练习次数
                word.stats.practiceCount = Math.max(logCount, Math.abs(proficiencyChange));
                
                if (proficiencyChange > 0) {
                    // 熟练度提升了，说明正确次数多
                    word.stats.correctCount = Math.ceil(word.stats.practiceCount * 0.6);
                    word.stats.errorCount = word.stats.practiceCount - word.stats.correctCount;
                } else if (proficiencyChange < 0) {
                    // 熟练度下降了，说明错误次数多
                    word.stats.errorCount = Math.ceil(word.stats.practiceCount * 0.6);
                    word.stats.correctCount = word.stats.practiceCount - word.stats.errorCount;
                } else {
                    // 熟练度不变，均分
                    word.stats.correctCount = Math.floor(word.stats.practiceCount / 2);
                    word.stats.errorCount = word.stats.practiceCount - word.stats.correctCount;
                }
                
                repairedCount++;
            }
        });

        if (repairedCount > 0) {
            this.saveWords(words);
            console.log(`✓ 已修复 ${repairedCount} 个单词的统计数据`);
        }

        return repairedCount;
    }

    // ==================== 句子管理方法 ====================
    
    // 获取所有句子
    static getSentences() {
        const data = localStorage.getItem(this.SENTENCE_KEY);
        const sentences = data ? JSON.parse(data) : [];
        
        // 数据迁移：确保每个句子都有必要的字段
        let needsSave = false;
        sentences.forEach(sentence => {
            if (!sentence.stats) {
                sentence.stats = {
                    practiceCount: 0,
                    correctCount: 0,
                    errorCount: 0,
                    lastPracticeTime: null
                };
                needsSave = true;
            }
            if (!sentence.tags) {
                sentence.tags = [];
                needsSave = true;
            }
        });
        
        if (needsSave) {
            this.saveSentences(sentences);
        }
        
        return sentences;
    }

    // 保存句子
    static saveSentences(sentences) {
        const data = JSON.stringify(sentences);
        this.setData(this.SENTENCE_KEY, data);
    }

    // 获取句子练习日志
    static getSentencePracticeLog() {
        const data = localStorage.getItem(this.SENTENCE_LOG_KEY);
        return data ? JSON.parse(data) : {};
    }

    // 保存句子练习日志
    static saveSentencePracticeLog(log) {
        const data = JSON.stringify(log);
        this.setData(this.SENTENCE_LOG_KEY, data);
    }

    // 记录今日句子练习
    static recordTodaySentencePractice(sentenceId, isCorrect) {
        const log = this.getSentencePracticeLog();
        const today = new Date().toISOString().split('T')[0];
        
        if (!log[today]) {
            log[today] = {
                sentenceIds: new Set(),
                correctCount: 0
            };
        } else {
            log[today].sentenceIds = new Set(log[today].sentenceIds || []);
        }
        
        log[today].sentenceIds.add(sentenceId);
        if (isCorrect) {
            log[today].correctCount = (log[today].correctCount || 0) + 1;
        }
        
        log[today].sentenceIds = Array.from(log[today].sentenceIds);
        this.saveSentencePracticeLog(log);
    }

    // 添加句子
    static addSentence(english, chinese, tags = []) {
        const sentences = this.getSentences();
        
        // 生成唯一ID
        let id;
        do {
            id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        } while (sentences.some(s => s.id === id));
        
        const newSentence = {
            id: id,
            english: english.trim(),
            chinese: chinese.trim(),
            tags: tags,
            proficiency: -100,
            addedTime: new Date().toISOString(),
            stats: {
                practiceCount: 0,
                correctCount: 0,
                errorCount: 0,
                lastPracticeTime: null
            }
        };
        
        sentences.push(newSentence);
        this.saveSentences(sentences);
        return newSentence;
    }

    // 更新句子
    static updateSentence(id, updates) {
        const sentences = this.getSentences();
        const sentence = sentences.find(s => s.id === id);
        if (sentence) {
            Object.assign(sentence, updates);
            this.saveSentences(sentences);
        }
    }

    // 删除句子
    static deleteSentence(id) {
        const sentences = this.getSentences();
        const filtered = sentences.filter(s => s.id !== id);
        this.saveSentences(filtered);
    }

    // 通过ID获取句子
    static getSentenceById(id) {
        const sentences = this.getSentences();
        return sentences.find(s => s.id === id);
    }

    // 获取熟练度最低的N个句子
    static getLowestProficiencySentences(n = 20) {
        const sentences = this.getSentences();
        return sentences
            .sort((a, b) => a.proficiency - b.proficiency)
            .slice(0, n);
    }

    // 按熟练度区间获取句子
    static getSentencesByProficiencyRange(minProficiency, maxProficiency) {
        const sentences = this.getSentences();
        return sentences.filter(s => s.proficiency >= minProficiency && s.proficiency <= maxProficiency);
    }

    // 获取今日新增句子
    static getTodayNewSentences() {
        const sentences = this.getSentences();
        const today = new Date().toISOString().split('T')[0];
        return sentences.filter(sentence => {
            const addedDate = sentence.addedTime.split('T')[0];
            return addedDate === today;
        });
    }

    // 按标签筛选句子
    static getSentencesByTags(tags) {
        if (!tags || tags.length === 0) {
            return this.getSentences();
        }
        const sentences = this.getSentences();
        return sentences.filter(sentence => {
            if (!sentence.tags || sentence.tags.length === 0) return false;
            return tags.some(tag => sentence.tags.includes(tag));
        });
    }
}


// ==================== 练习管理模块 ====================
class PracticeManager {
    constructor() {
        this.currentWord = null;
        this.lastWord = null; // 上一个单词
        this.currentMode = null;
        this.consecutiveErrors = 0;
        this.currentInput = '';
        this.errorRecorded = false; // 标记当前输入是否已记录错误
        this.enabledModes = {
            audio: true,
            chinese: true
        };
        this.proficiencyRange = {
            min: -100,
            max: 100
        };
        this.todayNewWordsOnly = false; // 是否只练习今日新词
        this.tagFilter = null; // 标签过滤
    }

    // 获取下一个练习单词
    getNextWord() {
        let availableWords;
        
        // 如果开启了今日新词模式
        if (this.todayNewWordsOnly) {
            availableWords = Storage.getTodayNewWords();
            
            // 如果没有今日新词，返回null
            if (availableWords.length === 0) return null;
            
            // 如果设置了标签过滤，进一步筛选
            if (this.tagFilter) {
                availableWords = availableWords.filter(word => 
                    word.tags && word.tags.includes(this.tagFilter)
                );
                if (availableWords.length === 0) return null;
            }
            
            // 从今日新词中按熟练度排序，取最低的20个
            const lowestWords = availableWords
                .sort((a, b) => a.proficiency - b.proficiency)
                .slice(0, Math.min(20, availableWords.length));
            
            // 随机选择一个
            const randomIndex = Math.floor(Math.random() * lowestWords.length);
            this.currentWord = lowestWords[randomIndex];
        } else {
            // 获取熟练度区间内的单词
            let wordsInRange = Storage.getWordsByProficiencyRange(
                this.proficiencyRange.min,
                this.proficiencyRange.max
            );
            
            // 如果设置了标签过滤，进一步筛选
            if (this.tagFilter) {
                wordsInRange = wordsInRange.filter(word => 
                    word.tags && word.tags.includes(this.tagFilter)
                );
            }
            
            if (wordsInRange.length === 0) return null;
            
            // 从区间内按熟练度排序，取最低的20个
            const lowestWords = wordsInRange
                .sort((a, b) => a.proficiency - b.proficiency)
                .slice(0, Math.min(20, wordsInRange.length));
            
            // 随机选择一个
            const randomIndex = Math.floor(Math.random() * lowestWords.length);
            this.currentWord = lowestWords[randomIndex];
        }
        
        // 随机选择练习模式
        const availableModes = [];
        if (this.enabledModes.audio) availableModes.push('audio');
        if (this.enabledModes.chinese) availableModes.push('chinese');
        
        if (availableModes.length === 0) {
            this.enabledModes.audio = true;
            availableModes.push('audio');
        }
        
        const modeIndex = Math.floor(Math.random() * availableModes.length);
        this.currentMode = availableModes[modeIndex];
        
        this.consecutiveErrors = 0;
        this.currentInput = '';
        this.errorRecorded = false; // 重置错误记录标记
        
        return {
            word: this.currentWord,
            mode: this.currentMode
        };
    }

    // 验证输入
    validateInput(input) {
        input = input.toLowerCase().trim();
        const targetWord = this.currentWord.word.toLowerCase();
        
        // 检查是否完全正确
        if (input === targetWord) {
            return {
                isComplete: true,
                isCorrect: true,
                feedback: '正确！'
            };
        }
        
        // 检查当前输入是否在正确的轨道上
        if (targetWord.startsWith(input)) {
            return {
                isComplete: false,
                isCorrect: true,
                feedback: '继续输入...'
            };
        }
        
        // 输入错误
        return {
            isComplete: false,
            isCorrect: false,
            feedback: '拼写错误，请重新输入'
        };
    }

    // 提交答案
    submitAnswer(input) {
        input = input.toLowerCase().trim();
        const targetWord = this.currentWord.word.toLowerCase();
        const isCorrect = input === targetWord;
        
        // 更新统计和熟练度
        const word = Storage.getWordById(this.currentWord.id);
        word.stats.practiceCount++;
        word.stats.lastPracticeTime = new Date().toISOString();
        
        if (isCorrect) {
            word.proficiency += 1;
            word.stats.correctCount++;
            this.consecutiveErrors = 0;
            // 记录今日练习（正确）
            Storage.recordTodayPractice(word.id, true);
        } else {
            word.proficiency -= 1;
            word.stats.errorCount++;
            this.consecutiveErrors++;
            // 记录今日练习（错误）
            Storage.recordTodayPractice(word.id, false);
        }
        
        Storage.updateWord(word.id, word);
        
        return {
            isCorrect,
            consecutiveErrors: this.consecutiveErrors,
            shouldShowAnswer: this.consecutiveErrors >= 5,
            correctWord: targetWord
        };
    }

    // 重置错误计数
    resetErrors() {
        this.consecutiveErrors = 0;
    }

    // 设置启用的模式
    setEnabledModes(audio, chinese) {
        this.enabledModes.audio = audio;
        this.enabledModes.chinese = chinese;
    }

    // 设置熟练度区间
    setProficiencyRange(min, max) {
        this.proficiencyRange.min = min;
        this.proficiencyRange.max = max;
    }

    // 设置是否只练习今日新词
    setTodayNewWordsOnly(enabled) {
        this.todayNewWordsOnly = enabled;
    }

    // 设置标签过滤
    setTagFilter(tag) {
        this.tagFilter = tag;
    }
}

// ==================== 句子练习管理模块 ====================
class SentencePracticeManager {
    constructor() {
        this.currentSentence = null;
        this.lastSentence = null;
        this.availableSentences = [];
        this.proficiencyRange = { min: -100, max: 100 };
        this.todayNewSentencesOnly = false;
        this.consecutiveErrors = 0;
        this.tagFilter = null;
    }

    // 设置熟练度区间
    setProficiencyRange(min, max) {
        this.proficiencyRange = { min, max };
    }

    // 设置今日新句子练习模式
    setTodayNewSentencesOnly(enabled) {
        this.todayNewSentencesOnly = enabled;
    }

    // 设置标签筛选
    setTagFilter(tag) {
        this.tagFilter = tag;
    }

    // 获取下一个句子
    getNextSentence() {
        // 保存上一个句子
        if (this.currentSentence) {
            this.lastSentence = { ...this.currentSentence };
        }

        let sentences;

        // 今日新句子模式
        if (this.todayNewSentencesOnly) {
            sentences = Storage.getTodayNewSentences();
            if (sentences.length === 0) {
                return null;
            }
        } else {
            // 按熟练度区间筛选
            sentences = Storage.getSentencesByProficiencyRange(
                this.proficiencyRange.min,
                this.proficiencyRange.max
            );
        }

        // 按标签筛选
        if (this.tagFilter) {
            sentences = sentences.filter(sentence => 
                sentence.tags && sentence.tags.includes(this.tagFilter)
            );
        }

        if (sentences.length === 0) {
            return null;
        }

        // 选择熟练度最低的20个，然后随机选一个
        const lowestSentences = sentences
            .sort((a, b) => a.proficiency - b.proficiency)
            .slice(0, Math.min(20, sentences.length));

        const randomIndex = Math.floor(Math.random() * lowestSentences.length);
        this.currentSentence = lowestSentences[randomIndex];
        this.consecutiveErrors = 0;

        return this.currentSentence;
    }

    // 检查答案（忽略标点符号）
    checkAnswer(userInput) {
        if (!this.currentSentence) return null;

        // 移除标点符号，转小写，去除首尾空格
        const normalize = (text) => {
            return text
                .toLowerCase()
                .replace(/[.,!?;:'"()[\]{}]/g, '')
                .trim();
        };

        const userAnswer = normalize(userInput);
        const correctAnswer = normalize(this.currentSentence.english);

        const isCorrect = userAnswer === correctAnswer;

        // 更新统计
        const sentence = Storage.getSentenceById(this.currentSentence.id);
        sentence.stats.practiceCount++;
        
        if (isCorrect) {
            sentence.proficiency++;
            sentence.stats.correctCount++;
            this.consecutiveErrors = 0;
        } else {
            sentence.proficiency--;
            sentence.stats.errorCount++;
            this.consecutiveErrors++;
        }
        
        sentence.stats.lastPracticeTime = new Date().toISOString();
        Storage.updateSentence(sentence.id, sentence);

        // 记录到练习日志
        Storage.recordTodaySentencePractice(sentence.id, isCorrect);

        return {
            isCorrect,
            consecutiveErrors: this.consecutiveErrors,
            sentence: this.currentSentence
        };
    }

    // 重置连续错误计数
    resetConsecutiveErrors() {
        this.consecutiveErrors = 0;
    }
}

// ==================== 发音管理模块 ====================
class AudioManager {
    constructor() {
        this.synthesis = window.speechSynthesis;
    }

    // 播放单词发音（使用Web Speech API）
    speak(word) {
        // 停止当前播放
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.8; // 稍慢一点
        utterance.pitch = 1;
        
        this.synthesis.speak(utterance);
    }

    // TODO: 将来可以集成更好的发音API
    // 例如：有道词典API、百度翻译API等
    async speakWithAPI(word) {
        // 这里可以集成第三方API
        // 示例：使用有道词典API
        // const audioUrl = await this.getYoudaoAudio(word);
        // const audio = new Audio(audioUrl);
        // audio.play();
    }
}

// ==================== UI控制器 ====================
class UIController {
    constructor() {
        this.practiceManager = new PracticeManager();
        this.sentencePracticeManager = new SentencePracticeManager();
        this.audioManager = new AudioManager();
        this.wordListClickHandler = null; // 存储事件处理器引用
        this.sentenceListClickHandler = null; // 存储句子列表事件处理器引用
        this.currentPracticeType = null; // 'word' 或 'sentence'
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTagFilter();
        this.loadTagList();
        this.loadWordList();
        this.loadSentenceList();
        this.updateStats();
    }

    bindEvents() {
        // 标签切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // 开始练习
        document.getElementById('start-practice-btn').addEventListener('click', () => this.startPractice());

        // 结束练习
        document.getElementById('stop-practice-btn').addEventListener('click', () => this.stopPractice());

        // 播放发音
        document.getElementById('play-audio-btn').addEventListener('click', () => this.playAudio());

        // 输入监听
        const wordInput = document.getElementById('word-input');
        wordInput.addEventListener('input', (e) => this.handleInput(e));
        wordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSubmit();
            }
        });

        // 练习类型切换
        document.getElementById('practice-words').addEventListener('change', (e) => {
            document.getElementById('word-mode-section').style.display = e.target.checked ? 'flex' : 'none';
        });

        // 添加单词
        document.getElementById('add-word-btn').addEventListener('click', () => this.addWord());

        // 批量导入单词
        document.getElementById('bulk-import-btn').addEventListener('click', () => this.bulkImport());

        // 单词列表排序
        document.getElementById('sort-by-proficiency').addEventListener('click', () => this.sortWordList('proficiency'));
        document.getElementById('sort-by-time').addEventListener('click', () => this.sortWordList('time'));

        // 修复统计数据
        document.getElementById('repair-stats-btn').addEventListener('click', () => this.repairStats());

        // 单词列表事件委托（编辑和删除按钮）
        // 确保只绑定一次
        const wordListContainer = document.getElementById('word-list');
        if (this.wordListClickHandler) {
            wordListContainer.removeEventListener('click', this.wordListClickHandler);
        }
        
        this.wordListClickHandler = (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const wordItem = button.closest('.word-item');
            if (!wordItem) return;

            const wordId = wordItem.dataset.wordId;
            const action = button.dataset.action;

            if (action === 'edit-tags') {
                this.editWordTags(wordId);
            } else if (action === 'delete') {
                this.deleteWord(wordId);
            }
        };
        
        wordListContainer.addEventListener('click', this.wordListClickHandler);

        // 数据导入导出
        document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        document.getElementById('import-file-input').addEventListener('change', (e) => this.importData(e));

        // 日历切换月份
        document.getElementById('prev-month').addEventListener('click', () => this.prevMonth());
        document.getElementById('next-month').addEventListener('click', () => this.nextMonth());

        // 日历显示切换
        document.getElementById('calendar-show-words').addEventListener('change', () => this.updateCalendar());
        document.getElementById('calendar-show-sentences').addEventListener('change', () => this.updateCalendar());

        // 高级设置展开/收起
        document.getElementById('toggle-advanced-settings').addEventListener('click', () => this.toggleAdvancedSettings());
        
        // 句子管理相关事件
        document.getElementById('add-sentence-btn').addEventListener('click', () => this.addSentence());
        document.getElementById('bulk-sentence-import-btn').addEventListener('click', () => this.bulkImportSentences());
        document.getElementById('sort-sentence-by-proficiency').addEventListener('click', () => this.sortSentenceList('proficiency'));
        document.getElementById('sort-sentence-by-time').addEventListener('click', () => this.sortSentenceList('time'));
        document.getElementById('export-sentence-data-btn').addEventListener('click', () => this.exportSentenceData());
        document.getElementById('import-sentence-data-btn').addEventListener('click', () => {
            document.getElementById('import-sentence-file-input').click();
        });
        document.getElementById('import-sentence-file-input').addEventListener('change', (e) => this.importSentenceData(e));

        // 句子列表事件委托
        const sentenceListContainer = document.getElementById('sentence-list');
        if (this.sentenceListClickHandler) {
            sentenceListContainer.removeEventListener('click', this.sentenceListClickHandler);
        }
        
        this.sentenceListClickHandler = (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const sentenceItem = button.closest('.word-item');
            if (!sentenceItem) return;

            const sentenceId = sentenceItem.dataset.sentenceId;
            const action = button.dataset.action;

            if (action === 'edit-tags') {
                this.editSentenceTags(sentenceId);
            } else if (action === 'delete') {
                this.deleteSentence(sentenceId);
            }
        };
        
        sentenceListContainer.addEventListener('click', this.sentenceListClickHandler);
        
        // 全局键盘快捷键
        document.addEventListener('keydown', (e) => this.handleGlobalKeyboard(e));
    }

    // 切换高级设置显示
    toggleAdvancedSettings() {
        const advancedSettings = document.getElementById('advanced-settings');
        const toggleBtn = document.getElementById('toggle-advanced-settings');
        
        if (advancedSettings.style.display === 'none') {
            advancedSettings.style.display = 'flex';
            toggleBtn.textContent = '高级设置 ▲';
        } else {
            advancedSettings.style.display = 'none';
            toggleBtn.textContent = '高级设置 ▼';
        }
    }

    // 处理全局键盘快捷键
    handleGlobalKeyboard(e) {
        // Alt 键：播放发音（听音模式重听，中文模式作为提示）
        if (e.key === 'Alt' && this.practiceManager.currentWord) {
            e.preventDefault();
            this.playAudio();
        }
    }

    // 切换标签
    switchTab(tabName) {
        // 更新按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // 更新内容显示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // 显示/隐藏练习操作栏
        const practiceToolbar = document.querySelector('.practice-toolbar');
        if (practiceToolbar) {
            practiceToolbar.style.display = (tabName === 'practice') ? 'flex' : 'none';
        }

        // 刷新对应页面的数据
        if (tabName === 'manage') {
            this.loadWordList();
            this.loadTagList();
        } else if (tabName === 'sentence') {
            this.loadSentenceList();
        } else if (tabName === 'stats') {
            this.updateStats();
        }
    }

    // 加载标签过滤下拉框
    loadTagFilter() {
        const tagFilter = document.getElementById('tag-filter');
        const allTags = Storage.getAllTags();
        
        // 清空现有选项（保留"全部标签"）
        tagFilter.innerHTML = '<option>全部标签</option>';
        
        // 添加所有标签选项
        allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
    }

    // 加载标签管理列表
    loadTagList() {
        const tagList = document.getElementById('tag-list');
        const allTags = Storage.getAllTags();
        
        if (allTags.length === 0) {
            tagList.innerHTML = '<div style="color: #888;">还没有标签</div>';
            return;
        }
        
        tagList.innerHTML = '';
        allTags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            
            const tagName = document.createElement('span');
            tagName.className = 'tag-item-name';
            tagName.textContent = tag;
            tagName.addEventListener('click', () => this.editTagName(tag));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'tag-item-delete';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => this.deleteTag(tag));
            
            tagItem.appendChild(tagName);
            tagItem.appendChild(deleteBtn);
            tagList.appendChild(tagItem);
        });
    }

    // 编辑标签名称
    editTagName(oldTag) {
        const newTag = prompt('重命名标签：', oldTag);
        if (newTag && newTag !== oldTag && newTag.trim()) {
            const trimmedTag = newTag.trim();
            const allTags = Storage.getAllTags();
            if (allTags.includes(trimmedTag)) {
                alert('该标签已存在！');
                return;
            }
            Storage.renameTag(oldTag, trimmedTag);
            this.loadTagList();
            this.loadTagFilter();
            this.loadWordList();
        }
    }

    // 删除标签
    deleteTag(tag) {
        if (confirm(`确定要删除标签"${tag}"吗？\n这将从所有单词中移除该标签。`)) {
            Storage.deleteTag(tag);
            this.loadTagList();
            this.loadTagFilter();
            this.loadWordList();
        }
    }

    // 开始练习
    startPractice() {
        const audioMode = document.getElementById('mode-audio').checked;
        const chineseMode = document.getElementById('mode-chinese').checked;
        const todayNewWordsOnly = document.getElementById('mode-today-new').checked;
        const selectedTag = document.getElementById('tag-filter').value;

        if (!audioMode && !chineseMode) {
            alert('请至少选择一种练习模式！');
            return;
        }

        // 获取熟练度区间设置
        const minProficiency = parseInt(document.getElementById('min-proficiency').value);
        const maxProficiency = parseInt(document.getElementById('max-proficiency').value);

        if (isNaN(minProficiency) || isNaN(maxProficiency)) {
            alert('请输入有效的熟练度数值！');
            return;
        }

        if (minProficiency < -9999 || minProficiency > 9999 || maxProficiency < -9999 || maxProficiency > 9999) {
            alert('熟练度必须在 -9999 到 9999 之间！');
            return;
        }

        if (minProficiency > maxProficiency) {
            alert('最低熟练度不能大于最高熟练度！');
            return;
        }

        const words = Storage.getWords();
        if (words.length === 0) {
            alert('请先添加单词！');
            this.switchTab('manage');
            return;
        }

        // 如果开启了今日新词模式
        if (todayNewWordsOnly) {
            const todayWords = Storage.getTodayNewWords();
            if (todayWords.length === 0) {
                alert('今天还没有添加新单词！');
                return;
            }
        } else {
            // 检查区间内是否有单词
            const wordsInRange = Storage.getWordsByProficiencyRange(minProficiency, maxProficiency);
            if (wordsInRange.length === 0) {
                alert(`熟练度区间 ${minProficiency} ~ ${maxProficiency} 内没有单词！\n请调整区间设置。`);
                return;
            }
        }

        this.practiceManager.setEnabledModes(audioMode, chineseMode);
        this.practiceManager.setProficiencyRange(minProficiency, maxProficiency);
        this.practiceManager.setTodayNewWordsOnly(todayNewWordsOnly);
        this.practiceManager.setTagFilter(selectedTag === '全部标签' ? null : selectedTag);

        // 隐藏开始按钮，显示结束按钮
        document.getElementById('start-practice-btn').style.display = 'none';
        document.getElementById('stop-practice-btn').style.display = 'block';
        
        document.getElementById('practice-area').style.display = 'block';

        this.nextWord();
    }

    // 停止练习
    stopPractice() {
        // 显示开始按钮，隐藏结束按钮
        document.getElementById('start-practice-btn').style.display = 'block';
        document.getElementById('stop-practice-btn').style.display = 'none';
        
        document.getElementById('practice-area').style.display = 'none';
        document.getElementById('last-word-display').style.display = 'none';
        this.clearInput();
        
        this.currentPracticeType = null;
        this.practiceManager.resetConsecutiveErrors();
        this.sentencePracticeManager.resetConsecutiveErrors();
        
        this.updateStats();
    }

    // 显示上一个单词
    showLastWord(word) {
        const lastWordDisplay = document.getElementById('last-word-display');
        if (!word) {
            lastWordDisplay.style.display = 'none';
            return;
        }
        
        const textLink = document.getElementById('last-word-link');
        const meaningsSpan = lastWordDisplay.querySelector('.last-word-meanings');
        
        // 设置单词文本和剑桥词典链接
        textLink.textContent = word.word;
        textLink.href = `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${encodeURIComponent(word.word)}`;
        textLink.title = `在剑桥词典中查看 "${word.word}"`;
        
        meaningsSpan.textContent = word.meanings.join('；');
        lastWordDisplay.style.display = 'block';
    }

    // 显示上一个句子
    showLastSentence(sentence) {
        const lastWordDisplay = document.getElementById('last-word-display');
        if (!sentence) {
            lastWordDisplay.style.display = 'none';
            return;
        }
        
        const textLink = document.getElementById('last-word-link');
        const meaningsSpan = lastWordDisplay.querySelector('.last-word-meanings');
        const labelElement = lastWordDisplay.querySelector('.last-word-label');
        
        // 修改标签显示
        labelElement.textContent = '上一个句子:';
        
        // 设置句子内容
        textLink.textContent = sentence.english;
        textLink.href = '#';
        textLink.title = sentence.chinese;
        textLink.onclick = (e) => e.preventDefault();
        
        meaningsSpan.textContent = sentence.chinese;
        lastWordDisplay.style.display = 'block';
    }

    // 显示正确的句子答案
    showCorrectSentence() {
        const sentence = this.sentencePracticeManager.currentSentence;
        const display = document.getElementById('correct-answer-display');
        const wordElement = display.querySelector('.correct-word');
        const meaningsElement = display.querySelector('.correct-meanings');

        wordElement.textContent = `✓ ${sentence.english}`;
        meaningsElement.textContent = sentence.chinese;

        display.style.display = 'block';
        
        // 隐藏输入框和其他提示
        document.getElementById('word-input').style.opacity = '0.5';
        document.getElementById('error-message').style.display = 'none';
    }

    // 显示正确答案（句子连续错误5次时）
    showCorrectAnswerForSentenceError(sentence) {
        const display = document.getElementById('correct-answer-display');
        const wordElement = display.querySelector('.correct-word');
        const meaningsElement = display.querySelector('.correct-meanings');

        wordElement.textContent = sentence.english;
        meaningsElement.textContent = sentence.chinese;

        display.style.display = 'block';
        
        // 隐藏输入框和其他提示
        document.getElementById('word-input').style.opacity = '0.5';
        document.getElementById('error-message').style.display = 'none';
    }

    // 下一个单词
    nextWord() {
        // 保存并显示上一个单词
        if (this.practiceManager.currentWord) {
            this.practiceManager.lastWord = this.practiceManager.currentWord;
            this.showLastWord(this.practiceManager.lastWord);
        }
        
        const result = this.practiceManager.getNextWord();
        if (!result) {
            alert('没有可练习的单词！');
            this.stopPractice();
            return;
        }

        this.clearInput();
        this.updatePracticeDisplay(result);
    }

    // 下一个句子
    nextSentence() {
        // 保存并显示上一个句子
        if (this.sentencePracticeManager.currentSentence) {
            this.sentencePracticeManager.lastSentence = this.sentencePracticeManager.currentSentence;
            this.showLastSentence(this.sentencePracticeManager.lastSentence);
        }
        
        const sentence = this.sentencePracticeManager.getNextSentence();
        if (!sentence) {
            alert('没有可练习的句子！');
            this.stopPractice();
            return;
        }

        this.clearInput();
        this.updateSentencePracticeDisplay(sentence);
    }

    // 更新句子练习显示
    updateSentencePracticeDisplay(sentence) {
        // 更新模式显示
        document.getElementById('current-mode-display').textContent = '📝 句子练习';
        document.getElementById('proficiency-display').textContent = `熟练度: ${sentence.proficiency}`;

        // 隐藏单词模式内容
        document.getElementById('audio-mode-content').style.display = 'none';
        document.getElementById('chinese-mode-content').style.display = 'none';

        // 显示句子中文翻译（复用chinese-mode-content）
        document.getElementById('chinese-mode-content').style.display = 'block';
        document.getElementById('chinese-meaning').textContent = sentence.chinese;
        
        const inputElement = document.getElementById('word-input');
        inputElement.classList.remove('with-hint');
        inputElement.placeholder = '请输入英文句子...';

        // 聚焦输入框
        inputElement.focus();
    }

    // 更新练习显示
    updatePracticeDisplay(result) {
        const { word, mode } = result;

        // 更新模式显示
        const modeText = mode === 'audio' ? '🔊 听发音模式' : '📖 看中文模式';
        document.getElementById('current-mode-display').textContent = modeText;
        document.getElementById('proficiency-display').textContent = `熟练度: ${word.proficiency}`;

        // 显示对应模式的内容
        document.getElementById('audio-mode-content').style.display = mode === 'audio' ? 'block' : 'none';
        document.getElementById('chinese-mode-content').style.display = mode === 'chinese' ? 'block' : 'none';

        const inputElement = document.getElementById('word-input');
        
        if (mode === 'audio') {
            // 音频模式：恢复默认样式
            inputElement.classList.remove('with-hint');
            inputElement.placeholder = '请输入单词拼写...';
            // 自动播放一次
            setTimeout(() => this.playAudio(), 300);
        } else {
            // 中文模式：显示中文释义和首字母提示
            const meanings = word.meanings;
            const randomMeaning = meanings[Math.floor(Math.random() * meanings.length)];
            document.getElementById('chinese-meaning').textContent = randomMeaning;
            
            // 在输入框显示首字母提示（保持原始大小写）
            const firstLetter = word.word.charAt(0);
            inputElement.classList.add('with-hint');
            inputElement.placeholder = `${firstLetter}${'_'.repeat(word.word.length - 1)}`;
        }

        // 聚焦输入框
        document.getElementById('word-input').focus();
    }

    // 播放发音
    playAudio() {
        if (this.practiceManager.currentWord) {
            this.audioManager.speak(this.practiceManager.currentWord.word);
        }
    }

    // 处理输入
    handleInput(e) {
        const input = e.target.value;
        const inputField = document.getElementById('word-input');
        const errorMessage = document.getElementById('error-message');

        inputField.classList.remove('correct', 'error');
        errorMessage.style.display = 'none';

        // 句子练习模式 - 不做实时验证，等待提交
        if (this.currentPracticeType === 'sentence') {
            return;
        }

        // 单词练习模式 - 实时验证
        const validation = this.practiceManager.validateInput(input);

        if (validation.isComplete && validation.isCorrect) {
            // 完全正确，立即提交答案
            inputField.classList.add('correct');
            this.handleSubmit();
        } else if (!validation.isCorrect && input.length > 0) {
            // 字母拼写错误
            inputField.classList.add('error');
            
            // 只在第一次检测到错误时记录熟练度变化
            if (!this.practiceManager.errorRecorded) {
                const word = this.practiceManager.currentWord;
                if (word) {
                    // 只降低熟练度，不更新统计（统计留给submitAnswer处理）
                    const updatedWord = Storage.getWordById(word.id);
                    updatedWord.proficiency -= 1;
                    Storage.updateWord(updatedWord.id, updatedWord);
                    this.practiceManager.consecutiveErrors++;
                    this.practiceManager.errorRecorded = true;
                    
                    // 检查是否连续错误5次
                    if (this.practiceManager.consecutiveErrors >= 5) {
                        // 达到5次，记录一次完整的错误统计
                        updatedWord.stats.errorCount++;
                        updatedWord.stats.practiceCount++;
                        updatedWord.stats.lastPracticeTime = new Date().toISOString();
                        Storage.updateWord(updatedWord.id, updatedWord);
                        Storage.recordTodayPractice(word.id, false);
                        
                        // 显示正确答案
                        this.showCorrectAnswerForError(word);
                        inputField.disabled = true;
                        this.practiceManager.resetErrors();
                        
                        // 3秒后切换到下一个单词
                        setTimeout(() => {
                            inputField.disabled = false;
                            this.nextWord();
                        }, 3000);
                    } else {
                        // 未达到5次，红框提示并清空输入框
                        this.showFeedback(`✗ 连续错误${this.practiceManager.consecutiveErrors}次`, 'error');
                        
                        // 延迟清空输入
                        setTimeout(() => {
                            inputField.value = '';
                            inputField.classList.remove('error');
                            errorMessage.style.display = 'none';
                            inputField.focus();
                            this.practiceManager.errorRecorded = false;
                        }, 500);
                    }
                }
            }
        }
    }

    // 提交答案
    handleSubmit() {
        const input = document.getElementById('word-input').value;
        if (!input.trim()) return;

        if (this.currentPracticeType === 'sentence') {
            // 句子练习提交
            const result = this.sentencePracticeManager.checkAnswer(input);
            const inputField = document.getElementById('word-input');
            
            if (result.isCorrect) {
                // 正确
                inputField.classList.add('correct');
                this.showCorrectSentence();
                setTimeout(() => {
                    // 切换到下一个练习项
                    this.switchToNextPracticeItem();
                }, 1000);
            } else {
                // 错误
                inputField.classList.add('error');
                this.sentencePracticeManager.consecutiveErrors++;
                
                // 检查是否连续错误5次
                if (this.sentencePracticeManager.consecutiveErrors >= 5) {
                    const sentence = this.sentencePracticeManager.currentSentence;
                    this.showCorrectAnswerForSentenceError(sentence);
                    inputField.disabled = true;
                    this.sentencePracticeManager.resetConsecutiveErrors();
                    
                    // 3秒后切换到下一个句子
                    setTimeout(() => {
                        inputField.disabled = false;
                        this.switchToNextPracticeItem();
                    }, 3000);
                } else {
                    // 清空输入，让用户重新输入
                    setTimeout(() => {
                        inputField.value = '';
                        inputField.classList.remove('error');
                        inputField.focus();
                    }, 500);
                }
            }
        } else {
            // 单词练习提交
            const result = this.practiceManager.submitAnswer(input);
            
            if (result.isCorrect) {
                // 正确，显示单词和释义
                this.showCorrectAnswer();
                setTimeout(() => this.switchToNextPracticeItem(), 1000);
            }
            // 注意：错误的情况已经在handleInput中处理了（连续错误5次）
            // 这里只处理正确的情况
        }
    }

    // 切换到下一个练习项（单词或句子）
    switchToNextPracticeItem() {
        const practiceWords = document.getElementById('practice-words').checked;
        const practiceSentences = document.getElementById('practice-sentences').checked;

        if (practiceWords && practiceSentences) {
            // 两种都选了，随机切换
            this.currentPracticeType = Math.random() < 0.5 ? 'word' : 'sentence';
        } else if (practiceWords) {
            this.currentPracticeType = 'word';
        } else {
            this.currentPracticeType = 'sentence';
        }

        if (this.currentPracticeType === 'word') {
            this.nextWord();
        } else {
            this.nextSentence();
        }
    }

    // 显示正确答案（拼写正确时）
    showCorrectAnswer() {
        const word = this.practiceManager.currentWord;
        const display = document.getElementById('correct-answer-display');
        const wordElement = display.querySelector('.correct-word');
        const meaningsElement = display.querySelector('.correct-meanings');

        wordElement.textContent = `✓ ${word.word}`;
        meaningsElement.textContent = word.meanings.join('；');

        display.style.display = 'block';
        
        // 隐藏输入框和其他提示
        document.getElementById('word-input').style.opacity = '0.5';
        document.getElementById('error-message').style.display = 'none';
        
        // 自动播放单词发音
        this.audioManager.speak(word.word);
    }

    // 显示正确答案（连续错误5次时）
    showCorrectAnswerForError(word) {
        const display = document.getElementById('correct-answer-display');
        const wordElement = display.querySelector('.correct-word');
        const meaningsElement = display.querySelector('.correct-meanings');

        wordElement.textContent = `${word.word}`;
        meaningsElement.textContent = word.meanings.join('；');

        display.style.display = 'block';
        
        // 隐藏输入框和其他提示
        document.getElementById('word-input').style.opacity = '0.5';
        document.getElementById('error-message').style.display = 'none';
        
        // 自动播放单词发音
        this.audioManager.speak(word.word);
    }

    // 显示反馈
    showFeedback(message, type, persistent = false) {
        const feedback = document.getElementById('error-message');
        feedback.textContent = message;
        feedback.style.display = 'block';
        feedback.className = `error-message ${type}`;

        if (!persistent) {
            setTimeout(() => {
                feedback.style.display = 'none';
            }, 2000);
        }
    }

    // 清空输入
    clearInput() {
        const input = document.getElementById('word-input');
        input.value = '';
        input.style.opacity = '1';
        input.classList.remove('correct', 'error');
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('correct-answer-display').style.display = 'none';
    }

    // 添加单词
    addWord() {
        const wordInput = document.getElementById('new-word');
        const meaningsInput = document.getElementById('new-meanings');
        const tagsInput = document.getElementById('new-tags');

        const word = wordInput.value.trim();
        const meaningsText = meaningsInput.value.trim();
        const tagsText = tagsInput.value.trim();

        if (!word || !meaningsText) {
            alert('请填写完整的单词和释义！');
            return;
        }

        const meanings = meaningsText.split(/[,，]/).filter(m => m.trim());
        if (meanings.length === 0) {
            alert('请至少填写一个释义！');
            return;
        }

        // 解析标签
        const tags = tagsText ? tagsText.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];

        // 检查是否已存在
        const existingWords = Storage.getWords();
        const existingWord = existingWords.find(w => w.word.toLowerCase() === word.toLowerCase());
        
        if (existingWord) {
            // 单词已存在，重置熟练度为-100但保留统计数据
            if (confirm(`单词"${word}"已存在！是否重置熟练度为-100并更新释义和标签？\n（注意：已有的练习统计数据将保留）`)) {
                // 重新获取最新的单词数据
                const wordToUpdate = Storage.getWordById(existingWord.id);
                wordToUpdate.proficiency = -100;
                wordToUpdate.meanings = meanings;
                wordToUpdate.tags = tags;
                // 保留 wordToUpdate.stats 统计数据不变
                Storage.updateWord(wordToUpdate.id, wordToUpdate);
                
                wordInput.value = '';
                meaningsInput.value = '';
                tagsInput.value = '';
                
                this.loadWordList();
                this.loadTagList();
                this.loadTagFilter();
                this.showFeedback('单词熟练度已重置！', 'success');
            }
            return;
        }

        Storage.addWord(word, meanings, tags);
        
        wordInput.value = '';
        meaningsInput.value = '';
        tagsInput.value = '';
        
        this.loadWordList();
        this.loadTagList();
        this.loadTagFilter();
        this.showFeedback('单词添加成功！', 'success');
    }

    // 批量导入单词
    bulkImport() {
        const bulkInput = document.getElementById('bulk-import');
        const text = bulkInput.value.trim();

        if (!text) {
            alert('请输入要导入的单词！');
            return;
        }

        const lines = text.split('\n').filter(line => line.trim());
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // 解析所有行，准备待添加的单词数据
        const wordsToAdd = [];
        lines.forEach((line, index) => {
            let trimmedLine = line.trim();
            if (!trimmedLine) return;

            // 合并多个连续空格为一个空格
            trimmedLine = trimmedLine.replace(/\s+/g, ' ');

            // 分割单词和释义（使用空格分隔）
            const firstSpaceIndex = trimmedLine.indexOf(' ');
            if (firstSpaceIndex === -1) {
                errorCount++;
                errors.push(`第${index + 1}行：格式错误，缺少空格分隔符`);
                return;
            }

            const word = trimmedLine.substring(0, firstSpaceIndex).trim();
            let remainingText = trimmedLine.substring(firstSpaceIndex + 1).trim();

            if (!word || !remainingText) {
                errorCount++;
                errors.push(`第${index + 1}行：单词或释义为空`);
                return;
            }

            // 尝试解析标签（格式：meanings [tag1,tag2]）
            let meaningsText = remainingText;
            let tags = [];
            const tagMatch = remainingText.match(/^(.+?)\s*\[([^\]]+)\]$/);
            if (tagMatch) {
                meaningsText = tagMatch[1].trim();
                tags = tagMatch[2].split(/[,，]/).map(t => t.trim()).filter(t => t);
            }

            // 解析释义（支持逗号分隔）
            const meanings = meaningsText.split(/[,，]/).map(m => m.trim()).filter(m => m);
            if (meanings.length === 0) {
                errorCount++;
                errors.push(`第${index + 1}行：没有有效的释义`);
                return;
            }

            wordsToAdd.push({ word, meanings, tags, lineNumber: index + 1 });
        });

        // 逐个添加单词（完全模拟 addWord 方法的逻辑）
        wordsToAdd.forEach(item => {
            const { word, meanings, tags, lineNumber } = item;
            
            // 检查是否已存在（每次都重新获取最新数据）
            const existingWords = Storage.getWords();
            const existingWord = existingWords.find(w => w.word.toLowerCase() === word.toLowerCase());
            
            if (existingWord) {
                // 单词已存在，重置熟练度但保留统计数据（与 addWord 相同逻辑）
                const wordToUpdate = Storage.getWordById(existingWord.id);
                wordToUpdate.proficiency = -100;
                wordToUpdate.meanings = meanings;
                wordToUpdate.tags = tags;
                // 保留 wordToUpdate.stats 统计数据不变
                Storage.updateWord(wordToUpdate.id, wordToUpdate);
                successCount++;
                return;
            }

            // 添加新单词（与 addWord 相同逻辑）
            try {
                Storage.addWord(word, meanings, tags);
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(`第${lineNumber}行：添加失败 - ${error.message}`);
            }
        });

        // 显示导入结果
        let message = `导入完成！\n成功: ${successCount} 个（包括重置已存在单词）\n失败: ${errorCount} 个`;
        
        if (errors.length > 0 && errors.length <= 5) {
            message += '\n\n错误详情：\n' + errors.join('\n');
        } else if (errors.length > 5) {
            message += '\n\n错误详情（前5条）：\n' + errors.slice(0, 5).join('\n');
        }

        alert(message);

        if (successCount > 0) {
            bulkInput.value = '';
            this.loadWordList();
            this.loadTagList();
            this.loadTagFilter();
            this.updateStats();
        }
    }

    // 加载单词列表
    loadWordList(sortBy = 'proficiency') {
        const words = Storage.getWords();
        const listContainer = document.getElementById('word-list');
        const countBadge = document.getElementById('word-count');

        countBadge.textContent = words.length;

        if (words.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">还没有添加单词</p>';
            return;
        }

        // 排序
        let sortedWords = [...words];
        if (sortBy === 'proficiency') {
            sortedWords.sort((a, b) => a.proficiency - b.proficiency);
        } else if (sortBy === 'time') {
            sortedWords.sort((a, b) => new Date(b.addedTime) - new Date(a.addedTime));
        }

        listContainer.innerHTML = sortedWords.map(word => {
            const addedDate = new Date(word.addedTime).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            
            // 渲染标签
            const tagsHtml = word.tags && word.tags.length > 0 
                ? `<div class="word-tags">
                    ${word.tags.map(tag => `<span class="word-tag">${tag}</span>`).join('')}
                   </div>`
                : '';
            
            return `
            <div class="word-item" data-word-id="${word.id}">
                <div class="word-info">
                    <div class="word-title">${word.word}</div>
                    <div class="word-meanings">${word.meanings.join(', ')}</div>
                    ${tagsHtml}
                    <div class="word-meta">
                        加入时间: ${addedDate} | 
                        练习: ${word.stats.practiceCount}次 | 
                        正确: ${word.stats.correctCount}次 | 
                        错误: ${word.stats.errorCount}次
                    </div>
                </div>
                <div class="word-proficiency">${word.proficiency}</div>
                <div class="word-actions">
                    <button class="btn btn-edit" data-action="edit-tags">编辑标签</button>
                    <button class="btn btn-delete" data-action="delete">删除</button>
                </div>
            </div>
        `;
        }).join('');
        
        // 注意：事件委托已在 bindEvents() 中绑定，这里不需要重复绑定
    }

    // 排序单词列表
    sortWordList(sortBy) {
        this.loadWordList(sortBy);
    }

    // 编辑单词标签
    editWordTags(id) {
        const word = Storage.getWordById(id);
        if (!word) return;
        
        const currentTags = word.tags && word.tags.length > 0 ? word.tags.join(',') : '';
        const newTagsText = prompt(`编辑单词"${word.word}"的标签（用逗号分隔）：`, currentTags);
        
        if (newTagsText !== null) {
            const newTags = newTagsText ? newTagsText.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
            word.tags = newTags;
            Storage.updateWord(id, word);
            this.loadWordList();
            this.loadTagList();
            this.loadTagFilter();
            this.showFeedback('标签已更新！', 'success');
        }
    }

    // 删除单词
    deleteWord(id) {
        Storage.deleteWord(id);
        this.loadWordList();
        this.loadTagList();
        this.loadTagFilter();
        this.updateStats();
    }

    // 修复统计数据
    repairStats() {
        if (confirm('将尝试从练习日志中恢复统计数据。\n此操作会覆盖当前统计为0的单词数据。\n是否继续？')) {
            const repairedCount = Storage.repairStatsFromLog();
            
            if (repairedCount > 0) {
                this.loadWordList();
                this.updateStats();
                alert(`成功修复 ${repairedCount} 个单词的统计数据！\n\n注意：修复的数据是根据练习日志和熟练度变化估算的，可能不完全准确。`);
            } else {
                alert('没有需要修复的数据。\n所有单词的统计数据都已正常记录。');
            }
        }
    }

    // 导出数据
    exportData() {
        const data = {
            words: Storage.getWords(),
            practiceLog: Storage.getPracticeLog(),
            exportTime: new Date().toISOString(),
            version: '1.0'
        };

        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `单词数据_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showFeedback('数据导出成功！', 'success');
    }

    // 导入数据
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.words || !Array.isArray(data.words)) {
                    alert('数据格式错误！');
                    return;
                }

                if (Storage.getWords().length > 0) {
                    if (!confirm('导入数据将覆盖当前所有数据，是否继续？')) {
                        return;
                    }
                }

                // 导入单词数据
                Storage.saveWords(data.words);
                
                // 导入练习日志（如果有）
                if (data.practiceLog) {
                    Storage.savePracticeLog(data.practiceLog);
                }

                // 刷新界面
                this.loadWordList();
                this.loadTagList();
                this.loadTagFilter();
                this.updateStats();
                
                alert(`导入成功！\n共导入 ${data.words.length} 个单词\n导出时间: ${new Date(data.exportTime).toLocaleString('zh-CN')}`);
            } catch (error) {
                alert('数据解析失败！请确保文件格式正确。\n错误: ' + error.message);
            }
        };
        reader.readAsText(file);
        
        // 重置文件选择，允许重复选择同一文件
        event.target.value = '';
    }

    // 更新统计
    updateStats() {
        const words = Storage.getWords();
        const sentences = Storage.getSentences();
        
        let totalPractice = 0;
        let totalCorrect = 0;
        let totalError = 0;

        words.forEach(word => {
            totalPractice += word.stats.practiceCount;
            totalCorrect += word.stats.correctCount;
            totalError += word.stats.errorCount;
        });

        sentences.forEach(sentence => {
            totalPractice += sentence.stats.practiceCount;
            totalCorrect += sentence.stats.correctCount;
            totalError += sentence.stats.errorCount;
        });

        document.getElementById('total-words').textContent = words.length;
        document.getElementById('total-sentences').textContent = sentences.length;
        document.getElementById('total-practice').textContent = totalPractice;
        document.getElementById('total-correct').textContent = totalCorrect;
        document.getElementById('total-error').textContent = totalError;

        // 更新打卡日历
        this.updateCalendar();

        // 单词详细统计
        const wordStatsListContainer = document.getElementById('word-stats-list');
        
        if (words.length === 0) {
            wordStatsListContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">还没有单词统计数据</p>';
        } else {
            const sortedWords = [...words].sort((a, b) => b.stats.practiceCount - a.stats.practiceCount);

            wordStatsListContainer.innerHTML = sortedWords.map(word => `
                <div class="word-stat-item">
                    <div class="word-stat-header">
                        <div class="word-stat-title">${word.word}</div>
                        <div class="word-stat-proficiency">${word.proficiency}</div>
                    </div>
                    <div class="word-stat-details">
                        <span>练习: ${word.stats.practiceCount}次</span>
                        <span>正确: ${word.stats.correctCount}次</span>
                        <span>错误: ${word.stats.errorCount}次</span>
                    </div>
                </div>
            `).join('');
        }

        // 句子详细统计
        const sentenceStatsListContainer = document.getElementById('sentence-stats-list');
        
        if (sentences.length === 0) {
            sentenceStatsListContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">还没有句子统计数据</p>';
        } else {
            const sortedSentences = [...sentences].sort((a, b) => b.stats.practiceCount - a.stats.practiceCount);

            sentenceStatsListContainer.innerHTML = sortedSentences.map(sentence => `
                <div class="word-stat-item">
                    <div class="word-stat-header">
                        <div class="word-stat-title">${sentence.english}</div>
                        <div class="word-stat-proficiency">${sentence.proficiency}</div>
                    </div>
                    <div class="word-stat-details">
                        <span>练习: ${sentence.stats.practiceCount}次</span>
                        <span>正确: ${sentence.stats.correctCount}次</span>
                        <span>错误: ${sentence.stats.errorCount}次</span>
                    </div>
                    <div style="color: #858585; font-size: 12px; margin-top: 5px;">${sentence.chinese}</div>
                </div>
            `).join('');
        }
    }

    // 更新打卡日历
    updateCalendar(year, month) {
        if (!year || !month) {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth();
        }

        this.currentCalendarYear = year;
        this.currentCalendarMonth = month;

        const showWords = document.getElementById('calendar-show-words').checked;
        const showSentences = document.getElementById('calendar-show-sentences').checked;

        const wordPracticeLog = Storage.getPracticeLog();
        const sentencePracticeLog = Storage.getSentencePracticeLog();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startWeekday = firstDay.getDay();

        // 更新标题
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
        document.getElementById('calendar-title').textContent = `${year}年 ${monthNames[month]}`;

        // 生成日历网格
        const calendarGrid = document.getElementById('calendar-grid');
        let gridHTML = '';

        // 添加星期标题
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        weekdays.forEach(day => {
            gridHTML += `<div class="calendar-weekday">${day}</div>`;
        });

        // 添加上月的空白天数
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startWeekday - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            gridHTML += `<div class="calendar-day other-month">
                <div class="day-number">${day}</div>
            </div>`;
        }

        // 添加当月的天数
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const wordDayLog = wordPracticeLog[dateStr];
            const sentenceDayLog = sentencePracticeLog[dateStr];
            
            let practiceClass = 'no-practice';
            let practiceInfo = '';
            let totalCount = 0;
            let totalCorrect = 0;
            
            if (showWords && wordDayLog) {
                const wordCount = wordDayLog.wordIds ? wordDayLog.wordIds.length : 0;
                const wordCorrect = wordDayLog.correctCount || 0;
                totalCount += wordCount;
                totalCorrect += wordCorrect;
            }
            
            if (showSentences && sentenceDayLog) {
                const sentenceCount = sentenceDayLog.sentenceIds ? sentenceDayLog.sentenceIds.length : 0;
                const sentenceCorrect = sentenceDayLog.correctCount || 0;
                totalCount += sentenceCount;
                totalCorrect += sentenceCorrect;
            }
            
            if (totalCount > 0) {
                let displayText = '';
                if (showWords && showSentences) {
                    const wc = wordDayLog ? (wordDayLog.wordIds ? wordDayLog.wordIds.length : 0) : 0;
                    const sc = sentenceDayLog ? (sentenceDayLog.sentenceIds ? sentenceDayLog.sentenceIds.length : 0) : 0;
                    displayText = `${wc}词 ${sc}句`;
                } else if (showWords) {
                    displayText = `${totalCount}词`;
                } else {
                    displayText = `${totalCount}句`;
                }
                practiceInfo = `${displayText} ${totalCorrect}对`;
                
                if (totalCount >= 16) {
                    practiceClass = 'high-practice';
                } else if (totalCount >= 6) {
                    practiceClass = 'medium-practice';
                } else {
                    practiceClass = 'low-practice';
                }
            }
            
            gridHTML += `<div class="calendar-day ${practiceClass} ${isToday ? 'today' : ''}" 
                              title="${dateStr}${practiceInfo ? '\n' + practiceInfo : ''}">
                <div class="day-number">${day}</div>
                ${practiceInfo ? `<div class="day-practice-count">${practiceInfo}</div>` : ''}
            </div>`;
        }

        // 添加下月的空白天数
        const remainingDays = 42 - (startWeekday + daysInMonth); // 6行x7列=42格
        for (let day = 1; day <= remainingDays; day++) {
            gridHTML += `<div class="calendar-day other-month">
                <div class="day-number">${day}</div>
            </div>`;
        }

        calendarGrid.innerHTML = gridHTML;
    }

    // 切换到上个月
    prevMonth() {
        let year = this.currentCalendarYear;
        let month = this.currentCalendarMonth - 1;
        
        if (month < 0) {
            month = 11;
            year--;
        }
        
        this.updateCalendar(year, month);
    }

    // 切换到下个月
    nextMonth() {
        let year = this.currentCalendarYear;
        let month = this.currentCalendarMonth + 1;
        
        if (month > 11) {
            month = 0;
            year++;
        }
        
        this.updateCalendar(year, month);
    }

    // ==================== 句子管理相关方法 ====================
    
    // 添加单个句子
    addSentence() {
        const englishInput = document.getElementById('new-sentence-english');
        const chineseInput = document.getElementById('new-sentence-chinese');
        const tagsInput = document.getElementById('new-sentence-tags');

        const english = englishInput.value.trim();
        const chinese = chineseInput.value.trim();
        const tagsText = tagsInput.value.trim();

        if (!english || !chinese) {
            alert('请填写完整的英文句子和中文翻译！');
            return;
        }

        const tags = tagsText ? tagsText.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];

        // 检查是否已存在
        const existingSentences = Storage.getSentences();
        const existingSentence = existingSentences.find(s => s.english.toLowerCase() === english.toLowerCase());
        
        if (existingSentence) {
            if (confirm(`句子"${english}"已存在！是否重置熟练度为-100并更新翻译和标签？`)) {
                const sentenceToUpdate = Storage.getSentenceById(existingSentence.id);
                sentenceToUpdate.proficiency = -100;
                sentenceToUpdate.chinese = chinese;
                sentenceToUpdate.tags = tags;
                Storage.updateSentence(sentenceToUpdate.id, sentenceToUpdate);
                
                englishInput.value = '';
                chineseInput.value = '';
                tagsInput.value = '';
                
                this.loadSentenceList();
                this.showFeedback('句子熟练度已重置！', 'success');
            }
            return;
        }

        Storage.addSentence(english, chinese, tags);
        
        englishInput.value = '';
        chineseInput.value = '';
        tagsInput.value = '';
        
        this.loadSentenceList();
        this.showFeedback('句子添加成功！', 'success');
    }

    // 批量导入句子
    bulkImportSentences() {
        const bulkInput = document.getElementById('bulk-sentence-import');
        const text = bulkInput.value.trim();

        if (!text) {
            alert('请输入要导入的句子！');
            return;
        }

        const lines = text.split('\n').filter(line => line.trim());
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // 解析所有行
        const sentencesToAdd = [];
        lines.forEach((line, index) => {
            let trimmedLine = line.trim();
            if (!trimmedLine) return;

            // 合并连续空格
            trimmedLine = trimmedLine.replace(/\s+/g, ' ');

            // 分割英文和中文（使用|分隔）
            const pipeIndex = trimmedLine.indexOf('|');
            if (pipeIndex === -1) {
                errorCount++;
                errors.push(`第${index + 1}行：格式错误，缺少"|"分隔符`);
                return;
            }

            const english = trimmedLine.substring(0, pipeIndex).trim();
            let remainingText = trimmedLine.substring(pipeIndex + 1).trim();

            if (!english || !remainingText) {
                errorCount++;
                errors.push(`第${index + 1}行：英文或中文为空`);
                return;
            }

            // 尝试解析标签（格式：中文 [tag1,tag2]）
            let chinese = remainingText;
            let tags = [];
            const tagMatch = remainingText.match(/^(.+?)\s*\[([^\]]+)\]$/);
            if (tagMatch) {
                chinese = tagMatch[1].trim();
                tags = tagMatch[2].split(/[,，]/).map(t => t.trim()).filter(t => t);
            }

            sentencesToAdd.push({ english, chinese, tags, lineNumber: index + 1 });
        });

        // 逐个添加句子
        sentencesToAdd.forEach(item => {
            const { english, chinese, tags, lineNumber } = item;
            
            // 检查是否已存在
            const existingSentences = Storage.getSentences();
            const existingSentence = existingSentences.find(s => s.english.toLowerCase() === english.toLowerCase());
            
            if (existingSentence) {
                const sentenceToUpdate = Storage.getSentenceById(existingSentence.id);
                sentenceToUpdate.proficiency = -100;
                sentenceToUpdate.chinese = chinese;
                sentenceToUpdate.tags = tags;
                Storage.updateSentence(sentenceToUpdate.id, sentenceToUpdate);
                successCount++;
                return;
            }

            // 添加新句子
            try {
                Storage.addSentence(english, chinese, tags);
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(`第${lineNumber}行：添加失败 - ${error.message}`);
            }
        });

        // 显示导入结果
        let message = `导入完成！\n成功: ${successCount} 个（包括重置已存在句子）\n失败: ${errorCount} 个`;
        
        if (errors.length > 0 && errors.length <= 5) {
            message += '\n\n错误详情：\n' + errors.join('\n');
        } else if (errors.length > 5) {
            message += '\n\n错误详情（前5条）：\n' + errors.slice(0, 5).join('\n');
        }

        alert(message);

        if (successCount > 0) {
            bulkInput.value = '';
            this.loadSentenceList();
        }
    }

    // 加载句子列表
    loadSentenceList(sortBy = 'proficiency') {
        const sentences = Storage.getSentences();
        const listContainer = document.getElementById('sentence-list');
        const countBadge = document.getElementById('sentence-count');

        countBadge.textContent = sentences.length;

        if (sentences.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">还没有添加句子</p>';
            return;
        }

        // 排序
        let sortedSentences = [...sentences];
        if (sortBy === 'proficiency') {
            sortedSentences.sort((a, b) => a.proficiency - b.proficiency);
        } else if (sortBy === 'time') {
            sortedSentences.sort((a, b) => new Date(b.addedTime) - new Date(a.addedTime));
        }

        listContainer.innerHTML = sortedSentences.map(sentence => {
            const addedDate = new Date(sentence.addedTime).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            
            // 渲染标签
            const tagsHtml = sentence.tags && sentence.tags.length > 0 
                ? `<div class="word-tags">
                    ${sentence.tags.map(tag => `<span class="word-tag">${tag}</span>`).join('')}
                   </div>`
                : '';
            
            return `
            <div class="word-item" data-sentence-id="${sentence.id}">
                <div class="word-info">
                    <div class="word-title">${sentence.english}</div>
                    <div class="word-meanings">${sentence.chinese}</div>
                    ${tagsHtml}
                    <div class="word-meta">
                        加入时间: ${addedDate} | 
                        练习: ${sentence.stats.practiceCount}次 | 
                        正确: ${sentence.stats.correctCount}次 | 
                        错误: ${sentence.stats.errorCount}次
                    </div>
                </div>
                <div class="word-proficiency">${sentence.proficiency}</div>
                <div class="word-actions">
                    <button class="btn btn-edit" data-action="edit-tags">编辑标签</button>
                    <button class="btn btn-delete" data-action="delete">删除</button>
                </div>
            </div>
        `;
        }).join('');
    }

    // 排序句子列表
    sortSentenceList(sortBy) {
        this.loadSentenceList(sortBy);
    }

    // 编辑句子标签
    editSentenceTags(id) {
        const sentence = Storage.getSentenceById(id);
        if (!sentence) return;
        
        const currentTags = sentence.tags && sentence.tags.length > 0 ? sentence.tags.join(',') : '';
        const newTagsText = prompt(`编辑句子"${sentence.english}"的标签（用逗号分隔）：`, currentTags);
        
        if (newTagsText !== null) {
            const newTags = newTagsText ? newTagsText.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
            sentence.tags = newTags;
            Storage.updateSentence(id, sentence);
            this.loadSentenceList();
            this.showFeedback('标签已更新！', 'success');
        }
    }

    // 删除句子
    deleteSentence(id) {
        Storage.deleteSentence(id);
        this.loadSentenceList();
    }

    // 导出句子数据
    exportSentenceData() {
        const sentences = Storage.getSentences();
        const sentenceLog = Storage.getSentencePracticeLog();
        
        const data = {
            sentences: sentences,
            sentencePracticeLog: sentenceLog,
            exportTime: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sentences-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showFeedback('句子数据导出成功！', 'success');
    }

    // 导入句子数据
    importSentenceData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.sentences || !Array.isArray(data.sentences)) {
                    alert('数据格式错误！');
                    return;
                }

                if (Storage.getSentences().length > 0) {
                    if (!confirm('导入数据将覆盖当前所有句子，是否继续？')) {
                        return;
                    }
                }

                // 导入句子数据
                Storage.saveSentences(data.sentences);
                
                // 导入练习日志（如果有）
                if (data.sentencePracticeLog) {
                    Storage.saveSentencePracticeLog(data.sentencePracticeLog);
                }

                // 刷新界面
                this.loadSentenceList();
                
                alert(`导入成功！\n共导入 ${data.sentences.length} 个句子\n导出时间: ${new Date(data.exportTime).toLocaleString('zh-CN')}`);
            } catch (error) {
                alert('数据解析失败！请确保文件格式正确。\n错误: ' + error.message);
            }
        };
        reader.readAsText(file);
        
        // 重置文件选择
        event.target.value = '';
    }
}

// ==================== 初始化应用 ====================
let ui;
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化存储并从云端同步数据
    await Storage.initialize();
    await Storage.syncFromCloud();
    
    ui = new UIController();
});
