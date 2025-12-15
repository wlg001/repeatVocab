// 测试句子管理功能
console.log('=== 测试开始 ===');

// 1. 检查Storage类是否正确加载
console.log('Storage类存在:', typeof Storage !== 'undefined');

// 2. 检查句子相关方法是否存在
console.log('getSentences方法存在:', typeof Storage.getSentences === 'function');
console.log('addSentence方法存在:', typeof Storage.addSentence === 'function');

// 3. 测试获取句子
try {
    const sentences = Storage.getSentences();
    console.log('当前句子数量:', sentences.length);
    console.log('句子数据:', sentences);
} catch (error) {
    console.error('获取句子出错:', error);
}

// 4. 检查DOM元素是否存在
console.log('sentence-tab元素存在:', document.getElementById('sentence-tab') !== null);
console.log('sentence-list元素存在:', document.getElementById('sentence-list') !== null);
console.log('sentence-count元素存在:', document.getElementById('sentence-count') !== null);

// 5. 检查UIController
setTimeout(() => {
    if (typeof window.uiController !== 'undefined') {
        console.log('UIController存在');
        console.log('sentencePracticeManager存在:', typeof window.uiController.sentencePracticeManager !== 'undefined');
    } else {
        console.log('UIController不存在');
    }
}, 1000);

console.log('=== 测试结束 ===');
