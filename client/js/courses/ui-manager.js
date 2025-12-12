/**
 * Handles rendering of course selection and challenge navigation UI
 */
export class CourseUIManager {
    constructor(courseManager) {
        this.courseManager = courseManager;
        this.courseSelectionEl = null;
        this.challengeBarEl = null;
        this.appContainerEl = null;
        this.challengeContentEl = null;
        this.backButton = null;
    }

    /**
     * Initialize UI elements
     */
    initialize() {
        this.courseSelectionEl = document.getElementById('courseSelection');
        this.challengeBarEl = document.getElementById('challengeBar');
        this.appContainerEl = document.querySelector('.app-shell');
        this.challengeContentEl = document.getElementById('challengeContent');
        this.backButton = document.getElementById('backToCourses');

        this._elements = {
            course: document.getElementById('challengeCourse'),
            title: document.getElementById('challengeTitle'),
            subtitle: document.getElementById('challengeSubtitle'),
            instructions: document.getElementById('challengeInstructions'),
            progressBar: document.getElementById('courseProgressBar'),
            progressFill: document.getElementById('courseProgressFill'),
        };

        if (this.backButton) {
            this.backButton.addEventListener('click', () => {
                if (!this.courseManager.isInCourse()) return;
                if (confirm('Exit the current course? Progress will be saved.')) {
                    this.courseManager.exitCourse();
                }
            });
        }
        
        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Render course selection screen
     */
    renderCourseSelection() {
        if (!this.courseSelectionEl) return;

        const courses = this.courseManager.courses;
        
        const html = `
            <div class="course-selection-content">
                <div class="course-header">
                    <h1>Sidekick</h1>
                    <p>Select a course to begin your journey</p>
                </div>
                <div class="course-grid">
                    ${courses.map(course => this.renderCourseCard(course)).join('')}
                </div>
            </div>
        `;
        
        this.courseSelectionEl.innerHTML = html;
        
        // Add click handlers to course cards
        courses.forEach(course => {
            const card = this.courseSelectionEl.querySelector(`[data-course-id="${course.id}"]`);
            if (card) {
                card.addEventListener('click', () => {
                    this.courseManager.selectCourse(course.id);
                });
            }
        });
    }

    /**
     * Render a single course card
     */
    renderCourseCard(course) {
        const progress = this.courseManager.getCourseProgress(course.id);
        const completionPercentage = this.courseManager.getCompletionPercentage(course.id);
        const hasStarted = progress && progress.completedChallenges.length > 0;
        
        return `
            <div class="course-card" data-course-id="${course.id}">
                <div class="course-icon">${course.icon}</div>
                <h3 class="course-title">${course.title}</h3>
                <p class="course-description">${course.description}</p>
                <div class="course-meta">
                    <span class="course-difficulty">${course.difficulty}</span>
                    <span class="course-time">⏱ ${course.estimatedTime}</span>
                </div>
                ${hasStarted ? `
                    <div class="course-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${completionPercentage}%"></div>
                        </div>
                        <span class="progress-text">${completionPercentage}% complete</span>
                    </div>
                ` : ''}
                <button class="course-start-btn">
                    ${hasStarted ? 'Continue' : 'Start Course'}
                </button>
            </div>
        `;
    }

    /**
     * Show course selection screen
     */
    showCourseSelection() {
        if (this.courseSelectionEl) {
            this.courseSelectionEl.style.display = 'flex';
        }
        if (this.appContainerEl) {
            this.appContainerEl.style.display = 'none';
        }
        if (this.challengeBarEl) {
            this.challengeBarEl.style.display = 'none';
        }
        if (this.challengeContentEl) {
            this.challengeContentEl.style.display = 'none';
        }
    }

    /**
     * Hide course selection screen
     */
    hideCourseSelection() {
        if (this.courseSelectionEl) {
            this.courseSelectionEl.style.display = 'none';
        }
        if (this.appContainerEl) {
            this.appContainerEl.style.display = 'flex';
        }
    }

    /**
     * Render challenge navigation bar
     */
    renderChallengeBar() {
        if (!this.challengeBarEl) return;

        const info = this.courseManager.getChallengeInfo();
        if (!info) return;

        const { current, total, challenge, course, isFirst, isLast } = info;
        
        const html = `
            <div class="challenge-bar-content">
                <div class="challenge-info">
                    <div class="course-badge">
                        <span class="course-icon-small">${course.icon}</span>
                        <span class="course-name">${course.title}</span>
                    </div>
                </div>
                <div class="challenge-progress-info">
                    <span class="challenge-counter">Challenge ${current} of ${total}</span>
                    <div class="challenge-progress-bar">
                        <div class="challenge-progress-fill" style="width: ${(current / total) * 100}%"></div>
                    </div>
                </div>
                <div class="challenge-actions">
                    <button id="exitCourseBtn" class="challenge-btn exit-btn" title="Exit Course">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                    </button>
                    <button id="prevChallengeBtn" class="challenge-btn nav-btn" ${isFirst ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Previous
                    </button>
                    <button id="nextChallengeBtn" class="challenge-btn nav-btn primary">
                        ${isLast ? 'Complete' : 'Next'}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        this.challengeBarEl.innerHTML = html;
    }

    /**
     * Show challenge navigation bar
     */
    showChallengeBar() {
        if (this.challengeBarEl) {
            this.challengeBarEl.style.display = 'block';
            this.renderChallengeBar();
        }
        if (this.challengeContentEl) {
            this.challengeContentEl.style.display = 'flex';
        }
        this.renderChallengeContent();
    }

    /**
     * Hide challenge navigation bar
     */
    hideChallengeBar() {
        if (this.challengeBarEl) {
            this.challengeBarEl.style.display = 'none';
        }
        if (this.challengeContentEl) {
            this.challengeContentEl.style.display = 'none';
        }
    }

    /**
     * Update challenge bar when challenge changes
     */
    updateChallengeBar() {
        this.renderChallengeBar();
        this.renderChallengeContent();
    }

    /**
     * Render the main challenge content area
     */
    renderChallengeContent() {
        const { course, title, subtitle, instructions, progressFill } = this._elements;
        const prevBtn = document.getElementById('prevChallengeBtn');
        const nextBtn = document.getElementById('nextChallengeBtn');

        if (!title || !subtitle || !instructions || !course) {
            return;
        }

        const info = this.courseManager.getChallengeInfo();
        if (!info) {
            course.textContent = 'Course title';
            title.textContent = 'Select a course to begin';
            subtitle.textContent = 'Challenge instructions will appear here once you start.';
            instructions.hidden = true;
            instructions.innerHTML = '';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) {
                nextBtn.textContent = 'Next challenge';
                nextBtn.disabled = true;
            }
            if (progressFill) {
                progressFill.style.width = '0%';
            }
            return;
        }

        const { challenge, course: courseInfo, isFirst, isLast, current, total } = info;
        course.textContent = courseInfo.title;
        title.textContent = `Challenge #${current}: ${challenge.title}`;
        subtitle.textContent = challenge.description;
        instructions.hidden = true;
        instructions.innerHTML = '';

        if (prevBtn) {
            prevBtn.disabled = isFirst;
        }

        if (nextBtn) {
            nextBtn.textContent = isLast ? 'Complete' : 'Next challenge';
            nextBtn.disabled = false;
        }

        // Update progress bar
        if (progressFill) {
            const progressPercentage = (current / total) * 100;
            progressFill.style.width = `${progressPercentage}%`;
        }
    }

    /**
     * Formats challenge instructions into structured HTML
     * @param {string|string[]} instructions
     * @returns {string}
     */
    formatInstructions(instructions) {
        if (!instructions) return '';

        const paragraphs = Array.isArray(instructions) ? instructions : instructions.split(/\n+/);

        const cleanedParagraphs = paragraphs
            .map(paragraph => paragraph.trim())
            .filter(Boolean);

        if (cleanedParagraphs.length === 0) {
            return '';
        }

        return cleanedParagraphs.map(text => {
            const stepMatch = text.match(/^(?:Step\s+)?(\d+)[\.:]\s*(.*)/i);
            if (stepMatch) {
                const [, stepNumber, body] = stepMatch;
                return `<p><strong>Step ${stepNumber}:</strong> ${body}</p>`;
            }

            const firstColon = text.indexOf(':');
            if (firstColon > -1 && firstColon < text.length - 1) {
                const heading = text.slice(0, firstColon + 1);
                const body = text.slice(firstColon + 1).trim();
                return `<p><strong>${heading}</strong> ${body}</p>`;
            }

            return `<p>${text}</p>`;
        }).join('');
    }

    /**
     * Show course completion celebration
     */
    showCourseCompletion(course) {
        const modal = document.createElement('div');
        modal.className = 'completion-modal';
        modal.innerHTML = `
            <div class="completion-content">
                <div class="completion-icon">🎉</div>
                <h2>Congratulations!</h2>
                <p>You've completed <strong>${course.title}</strong></p>
                <div class="completion-stats">
                    <div class="stat">
                        <span class="stat-value">${course.challenges.length}</span>
                        <span class="stat-label">Challenges Completed</span>
                    </div>
                </div>
                <button id="completionDoneBtn" class="completion-btn">
                    Choose Another Course
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Trigger animation
        setTimeout(() => modal.classList.add('active'), 10);
        
        // Handle button click
        const doneBtn = modal.querySelector('#completionDoneBtn');
        doneBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(modal);
                this.courseManager.exitCourse();
            }, 300);
        });
    }

    /**
     * Toggle challenge details panel
     */
    toggleChallengeDetails() {
        const panel = document.getElementById('challengeDetailsPanel');
        if (panel) {
            panel.classList.toggle('active');
        }
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Listen to course manager events
        this.courseManager.on('courses_loaded', () => {
            this.renderCourseSelection();
            this.showCourseSelection();
        });

        this.courseManager.on('course_selected', () => {
            this.hideCourseSelection();
            this.showChallengeBar();
        });

        this.courseManager.on('challenge_changed', () => {
            this.updateChallengeBar();
        });

        this.courseManager.on('course_completed', (course) => {
            this.showCourseCompletion(course);
        });

        this.courseManager.on('course_exited', () => {
            this.hideChallengeBar();
            this.showCourseSelection();
            this.renderCourseSelection();
        });

        // Set up delegated event listeners for challenge navigation buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'nextChallengeBtn' || e.target.closest('#nextChallengeBtn')) {
                this.courseManager.markChallengeComplete();
                this.courseManager.nextChallenge();
            } else if (e.target.id === 'prevChallengeBtn' || e.target.closest('#prevChallengeBtn')) {
                this.courseManager.previousChallenge();
            } else if (e.target.id === 'exitCourseBtn' || e.target.closest('#exitCourseBtn')) {
                if (confirm('Are you sure you want to exit this course? Your progress will be saved.')) {
                    this.courseManager.exitCourse();
                }
            }
        });
    }
}

