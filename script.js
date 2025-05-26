// Length and mood mappings
const lengthMap = {
    1: "Короткая",
    2: "Средняя",
    3: "Длинная"
};

const moodMap = {
    1: "Грустная",
    2: "Мрачная",
    3: "Нейтральное",
    4: "Вдохновляющая",
    5: "Весёлая"
};

// DOM Elements
const form = document.getElementById('bookForm');
const resultDiv = document.getElementById('result');
const lengthValue = document.getElementById('lengthValue');
const moodValue = document.getElementById('moodValue');
const randomBookButton = document.getElementById('randomBook');
const additionalFilters = document.getElementById('additionalFilters');
const toggleFiltersButton = document.getElementById('toggleFilters');
const toggleFiltersText = document.getElementById('toggleFiltersText');
const toggleFiltersIcon = toggleFiltersButton.querySelector('svg');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация ползунков
    const lengthInput = document.querySelector('input[name="length"]');
    const moodInput = document.querySelector('input[name="mood"]');

    if (lengthInput) {
        lengthInput.addEventListener('input', (e) => {
            lengthValue.textContent = lengthMap[e.target.value];
            updateRangeTrack(e.target);
        });
        updateRangeTrack(lengthInput);
    }

    if (moodInput) {
        moodInput.addEventListener('input', (e) => {
            moodValue.textContent = moodMap[e.target.value];
            updateRangeTrack(e.target);
        });
        updateRangeTrack(moodInput);
    }

    // Обработчик отправки формы
    form.addEventListener('submit', handleFormSubmit);

    // Обработчик кнопки случайной книги
    randomBookButton.addEventListener('click', handleRandomBook);

    // Обработчик переключения фильтров
    toggleFiltersButton.addEventListener('click', toggleAdditionalFilters);
});

// Функция для обновления заполнения ползунка
function updateRangeTrack(rangeInput) {
    const value = rangeInput.value;
    const min = rangeInput.min;
    const max = rangeInput.max;
    const percentage = ((value - min) / (max - min)) * 100;
    rangeInput.style.background = `linear-gradient(to right, hsl(var(--p)) 0%, hsl(var(--p)) ${percentage}%, hsl(var(--b3)) ${percentage}%, hsl(var(--b3)) 100%)`;
}

// Функция для переключения дополнительных фильтров
function toggleAdditionalFilters() {
    const isHidden = additionalFilters.classList.contains('hidden');
    additionalFilters.classList.toggle('hidden');
    toggleFiltersIcon.classList.toggle('rotate-180');
    toggleFiltersText.textContent = isHidden ? 'Скрыть дополнительные фильтры' : 'Дополнительные фильтры';
}

// Функция для перевода текста
async function translateText(text, targetLang = 'ru') {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        return data[0][0][0];
    } catch (error) {
        console.error('Ошибка при переводе:', error);
        return text;
    }
}

// Функция для получения книг из Google Books API
async function fetchBooks(query, filters = {}) {
    try {
        let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20`;
        if (filters.language) url += `&langRestrict=${filters.language}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.items) {
            return [];
        }

        let books = await Promise.all(data.items.map(async book => {
            const volumeInfo = book.volumeInfo;
            const pageCount = volumeInfo.pageCount || 0;
            
            let coverUrl = 'https://via.placeholder.com/300x450?text=Нет+обложки';
            if (volumeInfo.imageLinks) {
                coverUrl = volumeInfo.imageLinks.extraLarge || 
                          volumeInfo.imageLinks.large || 
                          volumeInfo.imageLinks.medium || 
                          volumeInfo.imageLinks.small || 
                          volumeInfo.imageLinks.thumbnail;
                
                coverUrl = coverUrl.replace('&edge=curl', '')
                                 .replace('&zoom=1', '')
                                 .replace('&source=gbs_api', '');
            }

            let description = volumeInfo.description || 'Описание отсутствует';
            if (volumeInfo.language && volumeInfo.language !== 'ru') {
                description = await translateText(description);
            }
            
            return {
                title: volumeInfo.title,
                author: volumeInfo.authors ? volumeInfo.authors[0] : 'Неизвестный автор',
                genre: volumeInfo.categories ? volumeInfo.categories[0] : 'Не указан',
                length: pageCount < 200 ? 1 : pageCount < 400 ? 2 : 3,
                mood: 3,
                description: description,
                cover: coverUrl,
                keywords: volumeInfo.categories || [],
                year: volumeInfo.publishedDate ? volumeInfo.publishedDate.split('-')[0] : 'Не указан',
                language: volumeInfo.language || 'Не указан',
                rating: volumeInfo.averageRating || 0,
                ratingCount: volumeInfo.ratingsCount || 0,
                previewLink: volumeInfo.previewLink,
                infoLink: volumeInfo.infoLink
            };
        }));

        if (filters.yearFrom) {
            books = books.filter(book => book.year >= filters.yearFrom);
        }
        if (filters.yearTo) {
            books = books.filter(book => book.year <= filters.yearTo);
        }

        if (filters.sort) {
            switch (filters.sort) {
                case 'year':
                    books.sort((a, b) => (b.year || 0) - (a.year || 0));
                    break;
                case 'popularity':
                    books.sort((a, b) => b.ratingCount - a.ratingCount);
                    break;
            }
        }

        return books;
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        return [];
    }
}

// Обработчик отправки формы
async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(form);
    const searchParams = {
        genre: formData.get('genre'),
        author: formData.get('author'),
        length: parseInt(formData.get('length')),
        mood: parseInt(formData.get('mood')),
        keywords: formData.get('keywords')?.toLowerCase().split(',').map(k => k.trim()) || [],
        yearFrom: formData.get('yearFrom'),
        yearTo: formData.get('yearTo'),
        language: formData.get('language'),
        sort: formData.get('sort')
    };

    resultDiv.innerHTML = `
        <div class="card-body">
            <div class="flex flex-col items-center justify-center py-8">
                <div class="loading"></div>
                <p class="mt-4 text-base-content/70">Ищем подходящие книги...</p>
            </div>
        </div>
    `;
    resultDiv.classList.remove('hidden');

    let searchQuery = '';
    if (searchParams.genre) searchQuery += `subject:${searchParams.genre} `;
    if (searchParams.author) searchQuery += `inauthor:${searchParams.author} `;
    if (searchParams.keywords[0]) searchQuery += searchParams.keywords.join(' ');

    const books = await fetchBooks(searchQuery, {
        yearFrom: searchParams.yearFrom,
        yearTo: searchParams.yearTo,
        language: searchParams.language,
        sort: searchParams.sort
    });
    
    const recommendedBook = findBook(books, searchParams);
    displayResult(recommendedBook);
}

// Обработчик кнопки случайной книги
async function handleRandomBook() {
    resultDiv.innerHTML = `
        <div class="card-body">
            <div class="flex flex-col items-center justify-center py-8">
                <div class="loading"></div>
                <p class="mt-4 text-base-content/70">Ищем случайную книгу...</p>
            </div>
        </div>
    `;
    resultDiv.classList.remove('hidden');

    const books = await fetchBooks('*');
    const randomBook = books[Math.floor(Math.random() * books.length)];
    displayResult(randomBook);
}

// Функция поиска книги
function findBook(books, params) {
    // Главные фильтры: жанр, длина, настроение
    const mainFilters = [
        book => !params.genre || book.genre.toLowerCase().includes(params.genre.toLowerCase()),
        book => book.length === params.length,
        book => book.mood === params.mood
    ];
    // Дополнительные фильтры
    const extraFilters = [
        book => !params.author || book.author.toLowerCase().includes(params.author.toLowerCase()),
        book => !params.keywords[0] || params.keywords.some(keyword => book.keywords.some(k => k.toLowerCase().includes(keyword))),
        book => !params.yearFrom || (book.year && book.year >= params.yearFrom),
        book => !params.yearTo || (book.year && book.year <= params.yearTo),
        book => !params.language || (book.language && book.language.toLowerCase().includes(params.language.toLowerCase()))
    ];

    // 1. Все главные фильтры + доп. фильтры
    let filtered = books.filter(book => mainFilters.every(f => f(book)) && extraFilters.every(f => f(book)));
    if (filtered.length) return filtered[0];
    // 2. Любые 2 главных фильтра (из 3) + доп. фильтры
    for (let i = 0; i < 3; i++) {
        filtered = books.filter(book => mainFilters.filter((f, idx) => idx !== i).every(f => f(book)) && extraFilters.every(f => f(book)));
        if (filtered.length) return filtered[0];
    }
    // 3. Любой 1 главный фильтр + доп. фильтры
    for (let i = 0; i < 3; i++) {
        filtered = books.filter(book => mainFilters[i](book) && extraFilters.every(f => f(book)));
        if (filtered.length) return filtered[0];
    }
    // 4. Только главные фильтры (без доп.)
    filtered = books.filter(book => mainFilters.every(f => f(book)));
    if (filtered.length) return filtered[0];
    // 5. Любые 2 главных фильтра (без доп.)
    for (let i = 0; i < 3; i++) {
        filtered = books.filter(book => mainFilters.filter((f, idx) => idx !== i).every(f => f(book)));
        if (filtered.length) return filtered[0];
    }
    // 6. Любой 1 главный фильтр (без доп.)
    for (let i = 0; i < 3; i++) {
        filtered = books.filter(book => mainFilters[i](book));
        if (filtered.length) return filtered[0];
    }
    // 7. Если ничего не найдено — вернуть первую книгу
    return books[0];
}

// Функция отображения результата
function displayResult(book) {
    if (!book) {
        resultDiv.innerHTML = `
            <div class="card-body">
                <div class="text-center py-8">
                    <p class="text-base-content/70">К сожалению, не удалось найти подходящую книгу. Попробуйте изменить параметры поиска.</p>
                </div>
            </div>
        `;
        resultDiv.classList.remove('hidden');
        return;
    }

    const ratingStars = book.rating ? Array(Math.floor(book.rating))
        .fill('⭐')
        .join('') : '';

    resultDiv.innerHTML = `
        <div class="card-body">
            <div class="flex flex-col md:flex-row gap-6">
                <div class="md:w-1/3">
                    <img src="${book.cover}" alt="${book.title}" 
                        class="w-full rounded-lg shadow-md book-cover" 
                        onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=Нет+обложки';">
                </div>
                <div class="md:w-2/3">
                    <h2 class="text-2xl font-bold text-base-content mb-2 hover:scale-[1.02] transition-transform duration-300">${book.title}</h2>
                    <p class="text-base-content/70 mb-4">Автор: ${book.author}</p>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <p class="text-base-content/70">Год издания: ${book.year}</p>
                        <p class="text-base-content/70">Язык: ${book.language}</p>
                        ${book.rating ? `
                            <p class="text-base-content/70">
                                Рейтинг: 
                                <span class="text-yellow-500 rating-star">${ratingStars}</span>
                                <span class="text-base-content/50">(${book.rating.toFixed(1)})</span>
                                <span class="text-base-content/40 text-sm">(${book.ratingCount} оценок)</span>
                            </p>
                        ` : ''}
                    </div>
                    <p class="text-base-content/80 mb-4 leading-relaxed">${book.description}</p>
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${book.keywords.map(keyword => 
                            `<span class="badge badge-primary gap-2 tag">${keyword}</span>`
                        ).join('')}
                    </div>
                    <div class="flex gap-4">
                        ${book.previewLink ? `
                            <a href="${book.previewLink}" target="_blank" 
                                class="btn btn-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                </svg>
                                Читать отрывок
                            </a>
                        ` : ''}
                        <a href="${book.infoLink}" target="_blank" 
                            class="btn btn-ghost">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                            Подробнее
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
    resultDiv.classList.remove('hidden');
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.toggleAdditionalFilters = toggleAdditionalFilters; 