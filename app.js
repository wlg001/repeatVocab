// ==================== 数据存储模块 ====================
class Storage {
    static STORAGE_KEY = 'vocabApp_words';

    // 获取所有单词
    static getWords() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    // 保存所有单词
    static saveWords(words) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(words));
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
}

// ==================== 练习管理模块 ====================
class PracticeManager {
    constructor() {
        this.currentWord = null;
        this.currentMode = null;
        this.consecutiveErrors = 0;
        this.currentInput = '';
        this.errorRecorded = false; // 标记当前输入是否已记录错误
        this.enabledModes = {
            audio: true,
            chinese: true
        };
    }

    // 获取下一个练习单词
    getNextWord() {
        const words = Storage.getLowestProficiencyWords(20);
        if (words.length === 0) return null;
        
        // 随机选择一个
        const randomIndex = Math.floor(Math.random() * words.length);
        this.currentWord = words[randomIndex];
        
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
        } else {
            word.proficiency -= 1;
            word.stats.errorCount++;
            this.consecutiveErrors++;
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

        if (!audioMode && !chineseMode) {
            alert('请至少选择一种练习模式！');
            return;
        }

        const words = Storage.getWords();
        if (words.length === 0) {
            alert('请先添加单词！');
            this.switchTab('manage');
            return;
        }

        this.practiceManager.setEnabledModes(audioMode, chineseMode);

        document.querySelector('.practice-settings').style.display = 'none';
        document.getElementById('practice-area').style.display = 'block';

        this.nextWord();
    }

    // 停止练习
    stopPractice() {
        document.querySelector('.practice-settings').style.display = 'block';
        document.getElementById('practice-area').style.display = 'none';
        this.clearInput();
    }

    // 下一个单词
    nextWord() {
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

        if (mode === 'audio') {
            // 自动播放一次
            setTimeout(() => this.playAudio(), 300);
        } else {
            // 显示中文释义（随机选一个）
            const meanings = word.meanings;
            const randomMeaning = meanings[Math.floor(Math.random() * meanings.length)];
            document.getElementById('chinese-meaning').textContent = randomMeaning;
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
            // 完全正确
            inputField.classList.add('correct');
            setTimeout(() => this.handleSubmit(), 500);
        } else if (!validation.isCorrect && input.length > 0) {
            // 输入错误，立即清空并要求重新输入
            inputField.classList.add('error');
            
            // 只在第一次检测到错误时记录
            if (!this.practiceManager.errorRecorded) {
                const word = this.practiceManager.currentWord;
                if (word) {
                    const updatedWord = Storage.getWordById(word.id);
                    updatedWord.proficiency -= 1;
                    updatedWord.stats.errorCount++;
                    updatedWord.stats.practiceCount++;
                    updatedWord.stats.lastPracticeTime = new Date().toISOString();
                    Storage.updateWord(updatedWord.id, updatedWord);
                    this.practiceManager.consecutiveErrors++;
                    this.practiceManager.errorRecorded = true; // 标记已记录错误
                    
                    // 显示错误提示，包含连续错误次数
                    this.showFeedback(`✗ 字母错误！请重新输入完整单词 (连续错误${this.practiceManager.consecutiveErrors}次)`, 'error');
                }
            }
            
            // 延迟清空输入，让用户看到错误提示
            setTimeout(() => {
                this.clearInput();
                inputField.focus();
                // 重置错误记录标记，允许下次输入时再次记录
                this.practiceManager.errorRecorded = false;
            }, 500);
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
            setTimeout(() => this.nextWord(), 1500);
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

    // 显示正确答案
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

        listContainer.innerHTML = sortedWords.map(word => `
            <div class="word-item">
                <div class="word-info">
                    <div class="word-title">${word.word}</div>
                    <div class="word-meanings">${word.meanings.join(', ')}</div>
                    <div class="word-meta">
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
        `).join('');
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
}

// ==================== 初始化应用 ====================
let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new UIController();
});
