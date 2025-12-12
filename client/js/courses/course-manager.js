/**
 * Manages course state, progress tracking, and navigation
 */
export class CourseManager {
    constructor() {
        this.courses = [];
        this.currentCourse = null;
        this.currentChallengeIndex = 0;
        this.progress = this.loadProgress();
        this._eventListeners = new Map();
        this._isTransitioning = false; // Prevent multiple transitions
    }

    /**
     * Load all courses from JSON files
     */
    async loadCourses() {
        try {
            // Load course index
            const coursesResponse = await fetch('js/courses/courses.json');
            if (!coursesResponse.ok) {
                throw new Error(`Failed to fetch courses.json: ${coursesResponse.status}`);
            }
            
            const coursesText = await coursesResponse.text();
            console.log('Raw courses.json content:', coursesText);
            
            if (!coursesText.trim()) {
                throw new Error('courses.json is empty');
            }
            
            const coursesIndex = JSON.parse(coursesText);
            console.log('Parsed courses index:', coursesIndex);
            
            // Load each course's detailed data
            this.courses = await Promise.all(
                coursesIndex.map(async (courseInfo) => {
                    const response = await fetch(`js/courses/${courseInfo.id}.json`);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${courseInfo.id}.json: ${response.status}`);
                    }
                    const courseData = await response.json();
                    return {
                        ...courseInfo,
                        ...courseData
                    };
                })
            );
            
            console.info('Loaded courses:', this.courses);
            this.emit('courses_loaded', this.courses);
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    /**
     * Select and start a course
     */
    selectCourse(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (!course) {
            console.error('Course not found:', courseId);
            return;
        }

        this.currentCourse = course;
        
        // Load progress for this course or start fresh
        const courseProgress = this.progress[courseId];
        if (courseProgress) {
            this.currentChallengeIndex = courseProgress.currentChallengeIndex || 0;
        } else {
            this.currentChallengeIndex = 0;
            this.progress[courseId] = {
                currentChallengeIndex: 0,
                completedChallenges: [],
                startedAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString()
            };
            this.saveProgress();
        }

        this.emit('course_selected', {
            course: this.currentCourse,
            challenge: this.getCurrentChallenge()
        });
    }

    /**
     * Get the current challenge
     */
    getCurrentChallenge() {
        if (!this.currentCourse) return null;
        return this.currentCourse.challenges[this.currentChallengeIndex];
    }

    /**
     * Navigate to the next challenge
     */
    nextChallenge() {
        if (!this.currentCourse || this._isTransitioning) return;
        
        this._isTransitioning = true;
        
        const maxIndex = this.currentCourse.challenges.length - 1;
        if (this.currentChallengeIndex < maxIndex) {
            this.currentChallengeIndex++;
            this.updateProgress();
            this.emit('challenge_changed', this.getCurrentChallenge());
        } else {
            // Course completed!
            this.emit('course_completed', this.currentCourse);
        }
        
        // Reset transition flag after a short delay
        setTimeout(() => {
            this._isTransitioning = false;
        }, 2000);
    }

    /**
     * Navigate to the previous challenge
     */
    previousChallenge() {
        if (!this.currentCourse || this._isTransitioning) return;
        
        this._isTransitioning = true;
        
        if (this.currentChallengeIndex > 0) {
            this.currentChallengeIndex--;
            this.updateProgress();
            this.emit('challenge_changed', this.getCurrentChallenge());
        }
        
        // Reset transition flag after a short delay
        setTimeout(() => {
            this._isTransitioning = false;
        }, 2000);
    }

    /**
     * Mark current challenge as complete
     */
    markChallengeComplete() {
        if (!this.currentCourse) return;
        
        const currentChallenge = this.getCurrentChallenge();
        const courseProgress = this.progress[this.currentCourse.id];
        
        if (!courseProgress.completedChallenges.includes(currentChallenge.id)) {
            courseProgress.completedChallenges.push(currentChallenge.id);
            this.saveProgress();
            this.emit('challenge_completed', currentChallenge);
        }
    }

    /**
     * Exit the current course
     */
    exitCourse() {
        if (this.currentCourse) {
            this.updateProgress();
        }
        this.currentCourse = null;
        this.currentChallengeIndex = 0;
        this.emit('course_exited');
    }

    /**
     * Get progress for a specific course
     */
    getCourseProgress(courseId) {
        return this.progress[courseId] || null;
    }

    /**
     * Get completion percentage for a course
     */
    getCompletionPercentage(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        const courseProgress = this.progress[courseId];
        
        if (!course || !courseProgress) return 0;
        
        const total = course.challenges.length;
        const completed = courseProgress.completedChallenges.length;
        
        return Math.round((completed / total) * 100);
    }

    /**
     * Check if user is currently in a course
     */
    isInCourse() {
        return this.currentCourse !== null;
    }

    /**
     * Check if currently transitioning between challenges
     */
    isTransitioning() {
        return this._isTransitioning;
    }

    /**
     * Get formatted challenge info for UI
     */
    getChallengeInfo() {
        if (!this.currentCourse) return null;
        
        return {
            current: this.currentChallengeIndex + 1,
            total: this.currentCourse.challenges.length,
            challenge: this.getCurrentChallenge(),
            course: this.currentCourse,
            isFirst: this.currentChallengeIndex === 0,
            isLast: this.currentChallengeIndex === this.currentCourse.challenges.length - 1
        };
    }

    /**
     * Update progress timestamp
     */
    updateProgress() {
        if (!this.currentCourse) return;
        
        const courseProgress = this.progress[this.currentCourse.id];
        courseProgress.currentChallengeIndex = this.currentChallengeIndex;
        courseProgress.lastAccessed = new Date().toISOString();
        this.saveProgress();
    }

    /**
     * Load progress from localStorage
     */
    loadProgress() {
        try {
            const stored = localStorage.getItem('courseProgress');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading progress:', error);
            return {};
        }
    }

    /**
     * Save progress to localStorage
     */
    saveProgress() {
        try {
            localStorage.setItem('courseProgress', JSON.stringify(this.progress));
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    /**
     * Event emitter methods
     */
    on(eventName, callback) {
        if (!this._eventListeners.has(eventName)) {
            this._eventListeners.set(eventName, []);
        }
        this._eventListeners.get(eventName).push(callback);
    }

    emit(eventName, data) {
        if (!this._eventListeners.has(eventName)) return;
        
        for (const callback of this._eventListeners.get(eventName)) {
            callback(data);
        }
    }
}

