// DOM Element References
const textDisplay = document.getElementById('text-display');
const timerDisplay = document.getElementById('timer');
const wpmDisplay = document.getElementById('wpm');
const accuracyDisplay = document.getElementById('accuracy');
const errorsDisplay = document.getElementById('errors');
const imeInput = document.getElementById('ime-input');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const englishBtn = document.getElementById('english-btn');
const chineseBtn = document.getElementById('chinese-btn');

// State Variables
var wordList = [];
var chineseWordList = [];
var currentIndex = 0;
var errors = 0;
var timer = null;
var timeLeft = 60;
var isTestActive = false;
var startTime = null;
var totalTyped = 0;
var characterStates = [];
var currentLanguage = 'english';
var inputBuffer = '';
var isComposing = false;

// Load from json files
async function loadWords() {
    try {
        const [englishResponse, chineseResponse] = await Promise.all([
            fetch('en_common.json'),
            fetch('cn_common.json')
        ]);
        
        const englishData = await englishResponse.json();
        const chineseData = await chineseResponse.json();
        
        wordList = englishData.data;
        chineseWordList = chineseData.map(item => item.traditional || item.char);
        startBtn.disabled = false;
    } catch (error) {
        console.error('Error loading word lists:', error);
        textDisplay.innerHTML = 'Error loading word lists. Please refresh the page.';
    }
}

function switchLanguage(language) {
    currentLanguage = language;
    englishBtn.classList.toggle('active', language === 'english');
    chineseBtn.classList.toggle('active', language === 'chinese');
    textDisplay.classList.toggle('chinese', language === 'chinese');
    
    const isChineseLang = language === 'chinese';
    imeInput.classList.toggle('active', isChineseLang);
    isChineseLang ? imeInput.focus() : imeInput.blur();
    
    if (isTestActive) resetTest();
}

function getRandomWords(count) {
    const currentList = currentLanguage === 'english' ? wordList : chineseWordList;
    return Array.from({ length: count }, () => 
        currentList[Math.floor(Math.random() * currentList.length)]);
}

function updateStats() {
    const timeElapsed = (60 - timeLeft) / 60;
    const wordsTyped = currentLanguage === 'english' 
        ? Math.round(totalTyped / 5) // English words' length is 5 in average
        : Math.round(totalTyped);
    const wpm = Math.round(wordsTyped / timeElapsed) || 0;
    const accuracy = Math.round(((totalTyped - errors) / totalTyped) * 100) || 0;

    wpmDisplay.textContent = wpm;
    accuracyDisplay.textContent = `${accuracy}%`;
    errorsDisplay.textContent = errors;
}

function generateText() {
    if (currentLanguage === 'english') {
        const words = getRandomWords(70);
        const sentences = [];
        
        for (let i = 0; i < 70; i += 10) {
            const sentenceWords = words.slice(i, i + 10);
            sentenceWords[0] = sentenceWords[0].charAt(0).toUpperCase() + sentenceWords[0].slice(1);
            sentences.push(sentenceWords.join(' '));
        }
        
        return sentences.join(' ');
    }
    return getRandomWords(100).join('');
}

function createCharacterSpans(text) {
    characterStates = new Array(text.length).fill('untyped');
    
    if (currentLanguage === 'english') {
        return text.split(' ').map(word => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word';
            
            [...word].forEach(char => {
                const span = document.createElement('span');
                span.textContent = char;
                span.className = 'char';
                wordSpan.appendChild(span);
            });
            
            const space = document.createElement('span');
            space.textContent = ' ';
            space.className = 'char space-char';
            wordSpan.appendChild(space);
            
            return wordSpan;
        });
    }
    
    return text.split('').map(char => {
        const span = document.createElement('span');
        span.textContent = char;
        span.className = 'char chinese-char';
        return span;
    });
}

function startTest() {
    if (wordList.length === 0) {
        textDisplay.innerHTML = 'Please wait for word list to load...';
        return;
    }
    isTestActive = true;
    currentIndex = 0;
    errors = 0;
    totalTyped = 0;
    timeLeft = 60;
    startTime = new Date();

    startBtn.disabled = true;
    resetBtn.disabled = false;

    const text = generateText();
    const chars = createCharacterSpans(text);
    textDisplay.innerHTML = '';
    chars.forEach(span => textDisplay.appendChild(span));
    
    const firstChar = textDisplay.querySelector('.char');
    if (firstChar) firstChar.classList.add('current');

    timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        updateStats();
        if (timeLeft <= 0) endTest();
    }, 1000);

    if (currentLanguage === 'chinese') {
        imeInput.classList.add('active');
        imeInput.focus();
    }
}

function endTest() {
    clearInterval(timer);
    isTestActive = false;
    textDisplay.innerHTML = 'Click Start to try again.';
    startBtn.disabled = false;
}

function resetTest() {
    clearInterval(timer);

    isTestActive = false;
    currentIndex = 0;
    errors = 0;
    totalTyped = 0;
    timeLeft = 60;
    characterStates = [];

    timerDisplay.textContent = timeLeft;
    textDisplay.innerHTML = 'Click Start to begin the test';
    startBtn.disabled = false;
    resetBtn.disabled = true;
    wpmDisplay.textContent = '0';
    accuracyDisplay.textContent = '0%';
    errorsDisplay.textContent = '0';

    if (currentLanguage === 'chinese') {
        imeInput.classList.add('active');
        imeInput.focus();
    } else {
        imeInput.classList.remove('active');
        imeInput.blur();
    }
}

function updateImePosition() {
    const currentChar = textDisplay.querySelector('.char.current');
    if (currentChar) {
        const rect = currentChar.getBoundingClientRect();
        imeInput.style.left = `${rect.left}px`;
        imeInput.style.top = `${rect.bottom + 5}px`;
    }
}

function handleEnglishKeydown(event) {
    const chars = Array.from(textDisplay.querySelectorAll('.char'));
    const currentChar = chars[currentIndex];
    
    // Handle backspace
    if (event.key === 'Backspace') {
        if (currentIndex > 0 && chars[currentIndex - 1].classList.contains('incorrect')) {
            currentIndex--;
            const prevChar = chars[currentIndex];
            prevChar.classList.remove('incorrect');
            prevChar.classList.add('current');
            chars[currentIndex + 1].classList.remove('current');
        }
        return;
    }

    if (!currentChar || event.key.length !== 1) return;

    const expectedKey = currentChar.textContent;
    
    if (hasIncorrectCharactersBefore()) return;

    if (event.key === expectedKey) {
        markCharacterCorrect(currentChar);
        moveToNextCharacter(chars);
    } else {
        markCharacterIncorrect(currentChar);
        moveToNextCharacter(chars);
    }

    checkAndUpdateTest(chars);
}

function handleChineseInput(input) {
    if (!input || !isTestActive) return;
    
    const chars = Array.from(textDisplay.querySelectorAll('.char'));
    const currentChar = chars[currentIndex];
    
    if (!currentChar) return;

    // Don't proceed if there are incorrect characters that haven't been corrected
    if (hasIncorrectCharactersBefore()) return;

    const expectedChar = currentChar.textContent;
    
    if (input === expectedChar) {
        markCharacterCorrect(currentChar);
        moveToNextCharacter(chars);
    } else {
        markCharacterIncorrect(currentChar);
        moveToNextCharacter(chars);
    }

    updateImePosition();
    checkAndUpdateTest(chars);
    imeInput.value = ''; // Clear the input after processing
}

function handleChineseKeydown(event) {
    // Handle backspace
    if (event.key === 'Backspace') {
        const chars = Array.from(textDisplay.querySelectorAll('.char'));
        if (currentIndex > 0) {
            currentIndex--;
            const currentChar = chars[currentIndex];
            const nextChar = chars[currentIndex + 1];
            
            // Remove classes from current character
            currentChar.classList.remove('correct', 'incorrect', 'corrected');
            currentChar.classList.add('current');
            
            // Remove current class from next character
            if (nextChar) {
                nextChar.classList.remove('current');
            }
            
            // If the character was marked incorrect, decrease error count
            if (characterStates[currentIndex] === 'incorrect') {
                errors--;
            }
            
            characterStates[currentIndex] = 'untyped';
            totalTyped--;
            
            updateStats();
            updateImePosition();
        }
        event.preventDefault(); // Prevent the backspace from affecting the IME input
    }
}

function hasIncorrectCharactersBefore() {
    const chars = Array.from(textDisplay.querySelectorAll('.char'));
    return chars.slice(0, currentIndex).some(char => char.classList.contains('incorrect'));
}

function markCharacterCorrect(char) {
    char.classList.remove('current', 'incorrect');
    if (characterStates[currentIndex] === 'incorrect') {
        char.classList.add('corrected');
    } else {
        char.classList.add('correct');
    }
    characterStates[currentIndex] = 'correct';
    totalTyped++;
}

function markCharacterIncorrect(char) {
    char.classList.add('incorrect');
    characterStates[currentIndex] = 'incorrect';
    errors++;
    totalTyped++;
}

function moveToNextCharacter(chars) {
    if (currentIndex < chars.length - 1) {
        chars[currentIndex].classList.remove('current');
        chars[currentIndex + 1].classList.add('current');
    }
    currentIndex++;
    
    if (currentLanguage === 'chinese') {
        updateImePosition();
    }
}

function checkAndUpdateTest(chars) {
    if (currentIndex >= chars.length) {
        const text = generateText();
        const newChars = createCharacterSpans(text);
        textDisplay.innerHTML = '';
        newChars.forEach(span => textDisplay.appendChild(span));
        currentIndex = 0;
        const firstChar = textDisplay.querySelector('.char');
        if (firstChar) {
            firstChar.classList.add('current');
        }
    }
    updateStats();
}

// Event Listeners
document.addEventListener('compositionstart', () => {
    isComposing = true;
});

document.addEventListener('compositionend', (event) => {
    isComposing = false;
    handleInput(event.data);
    inputBuffer = '';
});

document.addEventListener('keydown', event => {
    if (!isTestActive) return;
    if (currentLanguage === 'english') {
        handleEnglishKeydown(event);
    } else {
        handleChineseKeydown(event);
    }
});

document.addEventListener('input', event => {
    if (!isTestActive) return;
    
    if (currentLanguage === 'english') {
        if (!isComposing && event.data) {
            handleEnglishInput(event.data);
        }
    } else {
        if (isComposing) {
            inputBuffer = event.data || '';
        } else if (event.data) {
            handleChineseInput(event.data);
        }
    }
});

document.addEventListener('click', () => {
    if (isTestActive && currentLanguage === 'chinese') {
        imeInput.focus();
    }
});

// Textbox for Chinese input
imeInput.addEventListener('compositionstart', () => {
    isComposing = true;
    updateImePosition();
});

imeInput.addEventListener('compositionend', (e) => {
    isComposing = false;
    handleChineseInput(e.data);
    imeInput.value = '';
});

imeInput.addEventListener('input', (e) => {
    if (!isComposing) {
        handleChineseInput(e.data);
        imeInput.value = '';
    }
});

// Buttons
englishBtn.addEventListener('click', () => switchLanguage('english'));
chineseBtn.addEventListener('click', () => switchLanguage('chinese'));
startBtn.addEventListener('click', startTest);
resetBtn.addEventListener('click', resetTest);

// Initialize
loadWords();
