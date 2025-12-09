// ==================== 数据存储模块 ====================
class Storage {
    static STORAGE_KEY = 'vocabApp_words';
    static PRACTICE_LOG_KEY = 'vocabApp_practiceLog';
    
    // 初始化：从localStorage迁移数据到chrome.storage.sync
    static async initialize() {
        const statusEl = document.getElementById('sync-status');
        
        // 检测浏览器同步存储是否可用
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
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
        } else {
            console.log('ℹ 使用本地存储 - 数据不会同步');
            
            if (statusEl) {
                statusEl.textContent = 'ℹ️ 本地存储模式 - 请使用Chrome/Edge并登录账号以启用同步';
                statusEl.className = 'sync-status warning';
                statusEl.style.display = 'block';
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 5000);
            }
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
        return data ? JSON.parse(data) : [];
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
    static addWord(word, meanings) {
        const words = this.getWords();
        const newWord = {
            id: Date.now().toString(),
            word: word.toLowerCase().trim(),
            meanings: meanings.map(m => m.trim()),
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
    }

    // 获取下一个练习单词
    getNextWord() {
        let availableWords;
        
        // 如果开启了今日新词模式
        if (this.todayNewWordsOnly) {
            availableWords = Storage.getTodayNewWords();
            
            // 如果没有今日新词，返回null
            if (availableWords.length === 0) return null;
            
            // 从今日新词中按熟练度排序，取最低的20个
            const lowestWords = availableWords
                .sort((a, b) => a.proficiency - b.proficiency)
                .slice(0, Math.min(20, availableWords.length));
            
            // 随机选择一个
            const randomIndex = Math.floor(Math.random() * lowestWords.length);
            this.currentWord = lowestWords[randomIndex];
        } else {
            // 获取熟练度区间内的单词
            const wordsInRange = Storage.getWordsByProficiencyRange(
                this.proficiencyRange.min,
                this.proficiencyRange.max
            );
            
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
        this.audioManager = new AudioManager();
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadWordList();
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

        // 添加单词
        document.getElementById('add-word-btn').addEventListener('click', () => this.addWord());

        // 批量导入单词
        document.getElementById('bulk-import-btn').addEventListener('click', () => this.bulkImport());

        // 单词列表排序
        document.getElementById('sort-by-proficiency').addEventListener('click', () => this.sortWordList('proficiency'));
        document.getElementById('sort-by-time').addEventListener('click', () => this.sortWordList('time'));

        // 日历切换月份
        document.getElementById('prev-month').addEventListener('click', () => this.prevMonth());
        document.getElementById('next-month').addEventListener('click', () => this.nextMonth());
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
        } else if (tabName === 'stats') {
            this.updateStats();
        }
    }

    // 开始练习
    startPractice() {
        const audioMode = document.getElementById('mode-audio').checked;
        const chineseMode = document.getElementById('mode-chinese').checked;
        const todayNewWordsOnly = document.getElementById('mode-today-new').checked;

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
        const validation = this.practiceManager.validateInput(input);

        const inputField = document.getElementById('word-input');
        const errorMessage = document.getElementById('error-message');

        inputField.classList.remove('correct', 'error');
        errorMessage.style.display = 'none';

        if (validation.isComplete && validation.isCorrect) {
            // 完全正确，立即提交答案
            inputField.classList.add('correct');
            this.handleSubmit();
        } else if (!validation.isCorrect && input.length > 0) {
            // 字母拼写错误
            inputField.classList.add('error');
            
            // 只在第一次检测到错误时记录
            if (!this.practiceManager.errorRecorded) {
                const word = this.practiceManager.currentWord;
                if (word) {
                    // 记录错误统计
                    const updatedWord = Storage.getWordById(word.id);
                    updatedWord.proficiency -= 1;
                    updatedWord.stats.errorCount++;
                    updatedWord.stats.practiceCount++;
                    updatedWord.stats.lastPracticeTime = new Date().toISOString();
                    Storage.updateWord(updatedWord.id, updatedWord);
                    this.practiceManager.consecutiveErrors++;
                    this.practiceManager.errorRecorded = true;
                    
                    // 检查是否连续错误5次
                    if (this.practiceManager.consecutiveErrors >= 5) {
                        // 达到5次，用绿框显示正确答案3秒
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

        const result = this.practiceManager.submitAnswer(input);
        
        if (result.isCorrect) {
            // 正确，显示单词和释义
            this.showCorrectAnswer();
            setTimeout(() => this.nextWord(), 1000);
        } else {
            // 错误
            if (result.shouldShowAnswer) {
                // 连续错误5次，显示答案
                this.showFeedback(`连续错误5次！正确答案是: ${result.correctWord}`, 'error', true);
                this.practiceManager.resetErrors();
                setTimeout(() => this.nextWord(), 3000);
            } else {
                // 要求重新输入
                this.showFeedback(`✗ 拼写错误，请重新输入 (错误${result.consecutiveErrors}次)`, 'error');
                this.clearInput();
            }
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

        const word = wordInput.value.trim();
        const meaningsText = meaningsInput.value.trim();

        if (!word || !meaningsText) {
            alert('请填写完整的单词和释义！');
            return;
        }

        const meanings = meaningsText.split(/[,，]/).filter(m => m.trim());
        if (meanings.length === 0) {
            alert('请至少填写一个释义！');
            return;
        }

        // 检查是否已存在
        const existingWords = Storage.getWords();
        const existingWord = existingWords.find(w => w.word.toLowerCase() === word.toLowerCase());
        
        if (existingWord) {
            // 单词已存在，重置熟练度为-100
            if (confirm(`单词"${word}"已存在！是否重置熟练度为-100并更新释义？`)) {
                existingWord.proficiency = -100;
                existingWord.meanings = meanings;
                Storage.updateWord(existingWord.id, existingWord);
                
                wordInput.value = '';
                meaningsInput.value = '';
                
                this.loadWordList();
                this.showFeedback('单词熟练度已重置！', 'success');
            }
            return;
        }

        Storage.addWord(word, meanings);
        
        wordInput.value = '';
        meaningsInput.value = '';
        
        this.loadWordList();
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
        const existingWords = Storage.getWords();
        const existingWordsSet = new Set(existingWords.map(w => w.word.toLowerCase()));
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        const errors = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            // 分割单词和释义（使用空格分隔）
            const firstSpaceIndex = trimmedLine.indexOf(' ');
            if (firstSpaceIndex === -1) {
                errorCount++;
                errors.push(`第${index + 1}行：格式错误，缺少空格分隔符`);
                return;
            }

            const word = trimmedLine.substring(0, firstSpaceIndex).trim();
            const meaningsText = trimmedLine.substring(firstSpaceIndex + 1).trim();

            if (!word || !meaningsText) {
                errorCount++;
                errors.push(`第${index + 1}行：单词或释义为空`);
                return;
            }

            // 解析释义（支持逗号分隔）
            const meanings = meaningsText.split(/[,，]/).map(m => m.trim()).filter(m => m);
            if (meanings.length === 0) {
                errorCount++;
                errors.push(`第${index + 1}行：没有有效的释义`);
                return;
            }

            // 检查是否已存在
            if (existingWordsSet.has(word.toLowerCase())) {
                // 单词已存在，重置熟练度
                const existingWord = existingWords.find(w => w.word.toLowerCase() === word.toLowerCase());
                if (existingWord) {
                    existingWord.proficiency = -100;
                    existingWord.meanings = meanings;
                    Storage.updateWord(existingWord.id, existingWord);
                    successCount++;
                }
                return;
            }

            // 添加单词
            try {
                Storage.addWord(word, meanings);
                existingWordsSet.add(word.toLowerCase());
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(`第${index + 1}行：添加失败 - ${error.message}`);
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
            return `
            <div class="word-item">
                <div class="word-info">
                    <div class="word-title">${word.word}</div>
                    <div class="word-meanings">${word.meanings.join(', ')}</div>
                    <div class="word-meta">
                        加入时间: ${addedDate} | 
                        练习: ${word.stats.practiceCount}次 | 
                        正确: ${word.stats.correctCount}次 | 
                        错误: ${word.stats.errorCount}次
                    </div>
                </div>
                <div class="word-proficiency">${word.proficiency}</div>
                <div class="word-actions">
                    <button class="btn btn-delete" onclick="ui.deleteWord('${word.id}')">删除</button>
                </div>
            </div>
        `;
        }).join('');
    }

    // 排序单词列表
    sortWordList(sortBy) {
        this.loadWordList(sortBy);
    }

    // 删除单词
    deleteWord(id) {
        if (confirm('确定要删除这个单词吗？')) {
            Storage.deleteWord(id);
            this.loadWordList();
            this.updateStats();
        }
    }

    // 更新统计
    updateStats() {
        const words = Storage.getWords();
        
        let totalPractice = 0;
        let totalCorrect = 0;
        let totalError = 0;

        words.forEach(word => {
            totalPractice += word.stats.practiceCount;
            totalCorrect += word.stats.correctCount;
            totalError += word.stats.errorCount;
        });

        document.getElementById('total-words').textContent = words.length;
        document.getElementById('total-practice').textContent = totalPractice;
        document.getElementById('total-correct').textContent = totalCorrect;
        document.getElementById('total-error').textContent = totalError;

        // 更新打卡日历
        this.updateCalendar();

        // 单词详细统计
        const statsListContainer = document.getElementById('word-stats-list');
        
        if (words.length === 0) {
            statsListContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">还没有统计数据</p>';
            return;
        }

        const sortedWords = [...words].sort((a, b) => b.stats.practiceCount - a.stats.practiceCount);

        statsListContainer.innerHTML = sortedWords.map(word => `
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

    // 更新打卡日历
    updateCalendar(year, month) {
        if (!year || !month) {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth();
        }

        this.currentCalendarYear = year;
        this.currentCalendarMonth = month;

        const practiceLog = Storage.getPracticeLog();
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
            const dayLog = practiceLog[dateStr];
            
            let practiceClass = 'no-practice';
            let practiceInfo = '';
            
            if (dayLog) {
                const wordCount = dayLog.wordIds ? dayLog.wordIds.length : 0;
                const correctCount = dayLog.correctCount || 0;
                
                if (wordCount > 0) {
                    practiceInfo = `${wordCount}词 ${correctCount}对`;
                    
                    if (wordCount >= 16) {
                        practiceClass = 'high-practice';
                    } else if (wordCount >= 6) {
                        practiceClass = 'medium-practice';
                    } else {
                        practiceClass = 'low-practice';
                    }
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
}

// ==================== 初始化应用 ====================
let ui;
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化存储并从云端同步数据
    await Storage.initialize();
    await Storage.syncFromCloud();
    
    ui = new UIController();
});
