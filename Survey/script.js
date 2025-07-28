        // Configuration
        const CONFIG = {
            AUTO_RESTART_TIME: 30,
            // TODO: Add your API endpoint configuration
            API_BASE_URL: '/api', // Replace with your backend API URL
            SUBMIT_ENDPOINT: '/surveys' // Replace with your survey submission endpoint
        };

        // Enhanced date field setup with strict 90-day limit and today's default
        function setupDateField() {
            const dateInput = document.querySelector('input[name="visit_date"]');
            if (dateInput) {
                try {
                    // Get current system date
                    const today = new Date();
                    const ninetyDaysAgo = new Date();
                    ninetyDaysAgo.setDate(today.getDate() - 90);
                    
                    // Format dates properly for input[type="date"]
                    const todayString = today.toISOString().split('T')[0];
                    const ninetyDaysAgoString = ninetyDaysAgo.toISOString().split('T')[0];
                    
                    // Set constraints and default to TODAY'S DATE
                    dateInput.max = todayString;
                    dateInput.min = ninetyDaysAgoString;
                    dateInput.value = todayString; // Default to today's system date
                    
                    // Add validation to prevent manual entry of invalid dates
                    const validateDateRange = () => {
                        const selectedDate = new Date(dateInput.value);
                        const todayCheck = new Date();
                        const ninetyDaysAgoCheck = new Date();
                        ninetyDaysAgoCheck.setDate(todayCheck.getDate() - 90);
                        
                        if (selectedDate > todayCheck || selectedDate < ninetyDaysAgoCheck) {
                            dateInput.classList.add('error');
                            dateInput.style.borderColor = '#dc2626';
                            dateInput.style.backgroundColor = '#fef2f2';
                            return false;
                        } else {
                            dateInput.classList.remove('error');
                            dateInput.style.borderColor = '#10b981';
                            dateInput.style.backgroundColor = '#f0fdf4';
                            return true;
                        }
                    };
                    
                    // Add event listeners for date validation
                    dateInput.addEventListener('change', validateDateRange);
                    dateInput.addEventListener('blur', validateDateRange);
                    dateInput.addEventListener('input', validateDateRange);
                    
                    // Initial validation (should pass since we default to today)
                    validateDateRange();
                    
                } catch (error) {
                    console.warn('Date field setup failed:', error);
                    // Fallback: at least set today's date
                    const fallbackToday = new Date().toISOString().split('T')[0];
                    dateInput.value = fallbackToday;
                }
            }
        }

        // Enhanced field validation with better error clearing
        function clearFieldErrors(field) {
            if (!field) return;
            
            field.classList.remove('error');
            
            // For radio groups, clear all radios in the group
            if (field.type === 'radio') {
                const groupName = field.name;
                document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
                    radio.classList.remove('error');
                });
            }
        }

        // Setup field validation with comprehensive error handling
        function setupFieldValidation() {
            try {
                const allInputs = document.querySelectorAll('input, select, textarea');
                
                allInputs.forEach(field => {
                    if (!field) return;
                    
                    // Add touched class on first interaction
                    const addTouchedClass = () => {
                        field.classList.add('touched');
                    };

                    // Clear errors when user starts interacting
                    const clearErrors = () => {
                        clearFieldErrors(field);
                        
                        // Clear consent error specifically
                        if (field.name === 'consent_feedback_use') {
                            const consentCheckbox = document.getElementById('consentCheckbox');
                            const consentError = document.getElementById('consentError');
                            if (consentCheckbox) consentCheckbox.classList.remove('error');
                            if (consentError) consentError.classList.remove('show');
                        }
                    };

                    try {
                        // Add event listeners based on field type
                        if (field.type === 'radio' || field.type === 'checkbox') {
                            field.addEventListener('change', () => {
                                addTouchedClass();
                                clearErrors();
                            });
                        } else {
                            field.addEventListener('blur', addTouchedClass);
                            field.addEventListener('input', clearErrors);
                            field.addEventListener('change', clearErrors);
                        }
                    } catch (error) {
                        console.warn('Failed to setup validation for field:', field, error);
                    }
                });
            } catch (error) {
                console.error('Field validation setup failed:', error);
            }
        }

        // Enhanced validation function with comprehensive error handling
        function validateCurrentPage(pageIndex) {
            try {
                const currentPage = document.querySelector(`.page[data-page="${pageIndex}"]`);
                if (!currentPage) return true;
                
                // Clear previous errors
                currentPage.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
                currentPage.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
                currentPage.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
                currentPage.querySelectorAll('.consent-error').forEach(el => el.classList.remove('show'));
                
                const requiredFields = currentPage.querySelectorAll('[required]');
                let hasErrors = false;
                
                requiredFields.forEach(field => {
                    try {
                        if (field.type === 'radio') {
                            const groupName = field.name;
                            const checked = currentPage.querySelector(`input[name="${groupName}"]:checked`);
                            if (!checked) {
                                hasErrors = true;
                                currentPage.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
                                    radio.classList.add('error');
                                });
                            }
                        } else if (field.type === 'checkbox') {
                            if (!field.checked) {
                                hasErrors = true;
                                field.classList.add('error');
                                
                                // Special handling for consent checkbox
                                if (field.name === 'consent_feedback_use') {
                                    const consentCheckbox = document.getElementById('consentCheckbox');
                                    const consentError = document.getElementById('consentError');
                                    if (consentCheckbox) consentCheckbox.classList.add('error');
                                    if (consentError) consentError.classList.add('show');
                                }
                            }
                        } else if (!field.value.trim()) {
                            hasErrors = true;
                            field.classList.add('error');
                        }
                    } catch (error) {
                        console.warn('Validation error for field:', field, error);
                    }
                });
                
                // Special validation for phone field on page 1
                if (pageIndex === 1) {
                    try {
                        // Validate phone field
                        const phoneFieldElement = currentPage.querySelector('input[name="patient_phone"]');
                        if (phoneFieldElement) {
                            const phoneValue = phoneFieldElement.value.trim();
                            // Valid patterns: empty, +971xxxxxxxx (8-9 digits), +xxxxxxxxxxxx (10-15 digits), 05xxxxxxxx (UAE local)
                            const phonePattern = /^(\+971[0-9]{8,9}|\+[0-9]{10,15}|05[0-9]{8}|)$/;
                            
                            // Only block navigation if phone is invalid, don't override styling
                            if (phoneValue && !phonePattern.test(phoneValue)) {
                                hasErrors = true;
                                // Only add error class if user hasn't interacted yet
                                if (!phoneFieldElement.classList.contains('valid-phone')) {
                                    phoneFieldElement.classList.add('error');
                                    phoneFieldElement.style.borderColor = '#dc2626';
                                    phoneFieldElement.style.backgroundColor = '#fef2f2';
                                }
                            }
                        }

                        // Validate email field
                        const emailFieldElement = currentPage.querySelector('input[name="patient_email"]');
                        if (emailFieldElement) {
                            const emailValue = emailFieldElement.value.trim();
                            const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
                            
                            // Only block navigation if email is invalid, don't override styling
                            if (!emailValue || !emailPattern.test(emailValue)) {
                                hasErrors = true;
                                // Only add error class if user hasn't interacted yet
                                if (!emailFieldElement.classList.contains('valid-email')) {
                                    emailFieldElement.classList.add('error');
                                    emailFieldElement.style.borderColor = '#dc2626';
                                    emailFieldElement.style.backgroundColor = '#fef2f2';
                                }
                            }
                        }

                        // Validate date field - ensure it's within 90-day range
                        const dateFieldElement = currentPage.querySelector('input[name="visit_date"]');
                        if (dateFieldElement) {
                            const selectedDate = new Date(dateFieldElement.value);
                            const today = new Date();
                            const ninetyDaysAgo = new Date();
                            ninetyDaysAgo.setDate(today.getDate() - 90);
                            
                            if (!dateFieldElement.value || selectedDate > today || selectedDate < ninetyDaysAgo) {
                                hasErrors = true;
                                dateFieldElement.classList.add('error');
                                dateFieldElement.style.borderColor = '#dc2626';
                                dateFieldElement.style.backgroundColor = '#fef2f2';
                            } else {
                                dateFieldElement.classList.remove('error');
                                dateFieldElement.style.borderColor = '#10b981';
                                dateFieldElement.style.backgroundColor = '#f0fdf4';
                            }
                        }
                    } catch (error) {
                        console.warn('Phone/Email/Date validation error:', error);
                    }
                }
                
                // Special handling for page 9 (contact preferences)
                if (pageIndex === 9) {
                    try {
                        const wantContact = currentPage.querySelector('input[name="want_contact"]:checked');
                        if (!wantContact) {
                            hasErrors = true;
                            const errorEl = document.getElementById('contactRadioError');
                            if (errorEl) errorEl.classList.add('show');
                        } else if (wantContact.value === 'yes') {
                            const contactMethods = currentPage.querySelectorAll('input[name="contact_preference[]"]:checked');
                            if (contactMethods.length === 0) {
                                hasErrors = true;
                                const errorEl = document.getElementById('contactError');
                                const methodsEl = document.getElementById('contactMethods');
                                if (errorEl) errorEl.classList.add('show');
                                if (methodsEl) methodsEl.classList.add('has-error');
                            }
                        }
                    } catch (error) {
                        console.warn('Contact preferences validation failed:', error);
                    }
                }
                
                return !hasErrors;
            } catch (error) {
                console.error('Page validation failed:', error);
                return true; // Allow progression if validation fails
            }
        }

        // Setup navigation with validation
        function setupNavigation() {
            try {
                const nextLabels = document.querySelectorAll('.next-pages label');
                
                nextLabels.forEach((label, index) => {
                    if (label) {
                        label.addEventListener('click', (e) => {
                            try {
                                const currentPageIndex = index + 1;
                                if (!validateCurrentPage(currentPageIndex)) {
                                    e.preventDefault();
                                }
                            } catch (error) {
                                console.warn('Navigation validation failed:', error);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('Navigation setup failed:', error);
            }
        }

        // Setup contact preferences with error handling
        function setupContactPreferences() {
            try {
                const wantContactRadios = document.querySelectorAll('input[name="want_contact"]');
                const contactMethodsWrapper = document.getElementById('contactMethodsWrapper');
                
                wantContactRadios.forEach(radio => {
                    if (radio) {
                        radio.addEventListener('change', () => {
                            try {
                                // Clear any existing errors first
                                const errorEl = document.getElementById('contactRadioError');
                                if (errorEl) errorEl.classList.remove('show');
                                
                                if (radio.value === 'yes') {
                                    if (contactMethodsWrapper) contactMethodsWrapper.classList.add('show');
                                } else {
                                    if (contactMethodsWrapper) contactMethodsWrapper.classList.remove('show');
                                    // Clear contact method errors
                                    const contactError = document.getElementById('contactError');
                                    const contactMethods = document.getElementById('contactMethods');
                                    if (contactError) contactError.classList.remove('show');
                                    if (contactMethods) contactMethods.classList.remove('has-error');
                                    // Uncheck all contact preferences
                                    document.querySelectorAll('input[name="contact_preference[]"]').forEach(cb => {
                                        if (cb) cb.checked = false;
                                    });
                                }
                            } catch (error) {
                                console.warn('Contact preference toggle failed:', error);
                            }
                        });
                    }
                });

                // Handle contact preference checkboxes to clear errors
                document.querySelectorAll('input[name="contact_preference[]"]').forEach(checkbox => {
                    if (checkbox) {
                        checkbox.addEventListener('change', () => {
                            try {
                                const contactError = document.getElementById('contactError');
                                const contactMethods = document.getElementById('contactMethods');
                                if (contactError) contactError.classList.remove('show');
                                if (contactMethods) contactMethods.classList.remove('has-error');
                            } catch (error) {
                                console.warn('Contact checkbox error clearing failed:', error);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('Contact preferences setup failed:', error);
            }
        }

        // Setup phone and email field validation with error handling
        function setupPhoneAndEmailFields() {
            try {
                // Phone field setup - Stay grey while typing, validate after stopping
                const phoneInput = document.querySelector('input[name="patient_phone"]');
                const phoneOption = document.getElementById('phoneOption');
                
                if (phoneInput && phoneOption) {
                    let phoneValidationTimeout;
                    let phoneHasInteracted = false;
                    
                    const validatePhoneField = () => {
                        const phoneValue = phoneInput.value.trim();
                        const phonePattern = /^(\+971[0-9]{8,9}|\+[0-9]{10,15}|05[0-9]{8}|)$/;
                        
                        // Remove existing classes
                        phoneInput.classList.remove('error', 'valid-phone');
                        
                        if (phoneValue && !phonePattern.test(phoneValue)) {
                            // Invalid phone format
                            phoneInput.classList.add('error');
                            phoneInput.style.borderColor = '#dc2626';
                            phoneInput.style.backgroundColor = '#fef2f2';
                        } else {
                            // Valid phone format or empty (both allowed)
                            phoneInput.classList.add('valid-phone');
                            phoneInput.style.borderColor = phoneValue ? '#10b981' : '#e2e8f0';
                            phoneInput.style.backgroundColor = phoneValue ? '#f0fdf4' : '#ffffff';
                        }
                        
                        // Show phone option if there's a complete valid phone number
                        if (phoneValue && phonePattern.test(phoneValue) && phoneValue.length >= 9) {
                            phoneOption.classList.add('show');
                        } else {
                            phoneOption.classList.remove('show');
                            // Uncheck phone checkbox if hidden
                            const phoneCheckbox = phoneOption.querySelector('input[type="checkbox"]');
                            if (phoneCheckbox) phoneCheckbox.checked = false;
                        }
                    };

                    const resetPhoneToGrey = () => {
                        if (!phoneHasInteracted) return;
                        // Set to grey while typing
                        phoneInput.classList.remove('error', 'valid-phone');
                        phoneInput.style.borderColor = '#6b7280'; // Slightly darker grey while typing
                        phoneInput.style.backgroundColor = '#f9fafb';
                    };

                    const handlePhoneInput = () => {
                        phoneHasInteracted = true;
                        
                        // Clear any existing timeout
                        if (phoneValidationTimeout) {
                            clearTimeout(phoneValidationTimeout);
                        }
                        
                        // Set to grey immediately when typing
                        resetPhoneToGrey();
                        
                        // Set new timeout to validate after user stops typing (800ms delay)
                        phoneValidationTimeout = setTimeout(() => {
                            validatePhoneField();
                        }, 800);
                    };

                    const handlePhoneBlur = () => {
                        phoneHasInteracted = true;
                        // Clear timeout and validate immediately on blur
                        if (phoneValidationTimeout) {
                            clearTimeout(phoneValidationTimeout);
                        }
                        validatePhoneField();
                    };

                    // Add event listeners for phone
                    phoneInput.addEventListener('input', handlePhoneInput);
                    phoneInput.addEventListener('keyup', handlePhoneInput);
                    phoneInput.addEventListener('blur', handlePhoneBlur);
                    phoneInput.addEventListener('change', handlePhoneBlur);
                    phoneInput.addEventListener('paste', () => {
                        phoneHasInteracted = true;
                        setTimeout(handlePhoneInput, 10);
                    });
                }

                // Email field setup - Stay grey while typing, validate after stopping
                const emailInput = document.querySelector('input[name="patient_email"]');
                if (emailInput) {
                    let validationTimeout;
                    let hasInteracted = false;
                    
                    const validateEmailField = () => {
                        if (!hasInteracted) return; // Don't validate until user interacts
                        
                        const emailValue = emailInput.value.trim();
                        const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
                        
                        // Remove existing classes
                        emailInput.classList.remove('error', 'valid-email');
                        
                        if (emailValue === '') {
                            // Empty - required field, show error only after interaction
                            emailInput.classList.add('error');
                            emailInput.style.borderColor = '#dc2626';
                            emailInput.style.backgroundColor = '#fef2f2';
                        } else if (emailPattern.test(emailValue)) {
                            // Valid email format
                            emailInput.classList.add('valid-email');
                            emailInput.style.borderColor = '#10b981';
                            emailInput.style.backgroundColor = '#f0fdf4';
                        } else {
                            // Invalid email format
                            emailInput.classList.add('error');
                            emailInput.style.borderColor = '#dc2626';
                            emailInput.style.backgroundColor = '#fef2f2';
                        }
                    };

                    const resetToGrey = () => {
                        if (!hasInteracted) return;
                        // Set to grey while typing
                        emailInput.classList.remove('error', 'valid-email');
                        emailInput.style.borderColor = '#6b7280'; // Slightly darker grey while typing
                        emailInput.style.backgroundColor = '#f9fafb';
                    };

                    const handleInput = () => {
                        hasInteracted = true;
                        
                        // Clear any existing timeout
                        if (validationTimeout) {
                            clearTimeout(validationTimeout);
                        }
                        
                        // Set to grey immediately when typing
                        resetToGrey();
                        
                        // Set new timeout to validate after user stops typing (800ms delay)
                        validationTimeout = setTimeout(() => {
                            validateEmailField();
                        }, 800);
                    };

                    const handleBlur = () => {
                        hasInteracted = true;
                        // Clear timeout and validate immediately on blur
                        if (validationTimeout) {
                            clearTimeout(validationTimeout);
                        }
                        validateEmailField();
                    };

                    // Add event listeners
                    emailInput.addEventListener('input', handleInput);
                    emailInput.addEventListener('keyup', handleInput);
                    emailInput.addEventListener('blur', handleBlur);
                    emailInput.addEventListener('change', handleBlur);
                    emailInput.addEventListener('paste', () => {
                        hasInteracted = true;
                        setTimeout(handleInput, 10);
                    });
                    
                    // Don't run initial validation - keep grey
                }
            } catch (error) {
                console.error('Phone and email field setup failed:', error);
            }
        }

        // Enhanced submit handler with backend integration
        function setupSubmitHandler() {
            try {
                const submitBtn = document.getElementById('submitBtn');
                if (submitBtn) {
                    submitBtn.addEventListener('click', async () => {
                        try {
                            // Validate last page
                            if (!validateCurrentPage(10)) {
                                return;
                            }
                            
                            // Show loading
                            const loadingEl = document.getElementById('loading');
                            if (loadingEl) loadingEl.classList.add('show');
                            
                            try {
                                // Get form data
                                const form = document.getElementById('surveyForm');
                                const formData = new FormData(form);
                                
                                // Check if surveyAPI is available
                                if (typeof window.surveyAPI === 'undefined') {
                                    throw new Error('Survey API not loaded. Please check Supabase integration.');
                                }
                                
                                // Optional: Check for duplicate submission
                                const email = formData.get('patient_email');
                                const visitDate = formData.get('visit_date');
                                const isDuplicate = await window.surveyAPI.checkDuplicateSubmission(email, visitDate);
                                
                                if (isDuplicate) {
                                    if (loadingEl) loadingEl.classList.remove('show');
                                    if (confirm('A survey for this email and visit date already exists. Do you want to submit anyway?')) {
                                        if (loadingEl) loadingEl.classList.add('show');
                                    } else {
                                        return;
                                    }
                                }
                                
                                // Submit to Supabase
                                const result = await window.surveyAPI.submitSurvey(formData);
                                
                                if (!result.success) {
                                    throw new Error(result.error || 'Failed to submit survey');
                                }
                                
                                console.log('Survey submitted successfully:', result.data);
                                
                                // Hide loading and show thank you
                                if (loadingEl) loadingEl.classList.remove('show');
                                const surveyContainer = document.querySelector('.survey-container');
                                const thankYou = document.getElementById('thankYou');
                                if (surveyContainer) surveyContainer.style.display = 'none';
                                if (thankYou) thankYou.classList.add('show');
                                
                                // Start countdown
                                startCountdown();
                                
                            } catch (error) {
                                console.error('Submit error:', error);
                                if (loadingEl) loadingEl.classList.remove('show');
                                alert('Error submitting survey: ' + error.message);
                            }
                        } catch (error) {
                            console.error('Submit handler error:', error);
                            alert('An unexpected error occurred. Please refresh the page and try again.');
                        }
                    });
                }
            } catch (error) {
                console.error('Submit handler setup failed:', error);
            }
        }

        // Countdown functionality
        function startCountdown() {
            try {
                let seconds = CONFIG.AUTO_RESTART_TIME;
                const countdownEl = document.getElementById('countdown');
                if (countdownEl) countdownEl.textContent = seconds;
                
                const countdownTimer = setInterval(() => {
                    try {
                        seconds--;
                        if (countdownEl) countdownEl.textContent = seconds;
                        if (seconds <= 0) {
                            clearInterval(countdownTimer);
                            resetSurvey();
                        }
                    } catch (error) {
                        console.warn('Countdown error:', error);
                        clearInterval(countdownTimer);
                    }
                }, 1000);
            } catch (error) {
                console.error('Countdown setup failed:', error);
            }
        }

        // Enhanced reset survey function
        function resetSurvey() {
            try {
                // Reset form
                const form = document.getElementById('surveyForm');
                if (form) form.reset();
                
                // Reset to first page
                const firstPage = document.getElementById('page1');
                if (firstPage) firstPage.checked = true;
                
                // Reset date
                setupDateField();
                
                // Reset phone to empty (no default value)
                const phoneField = document.querySelector('input[name="patient_phone"]');
                if (phoneField) phoneField.value = '';
                
                // Reset phone field styling to neutral grey state
                const phoneFieldReset = document.querySelector('input[name="patient_phone"]');
                if (phoneFieldReset) {
                    phoneFieldReset.value = '';
                    phoneFieldReset.classList.remove('error', 'valid-phone', 'touched');
                    phoneFieldReset.style.borderColor = '#e2e8f0'; // Default grey border
                    phoneFieldReset.style.backgroundColor = '#ffffff'; // Default white background
                }
                
                // Reset email field styling to neutral grey state
                const emailFieldReset = document.querySelector('input[name="patient_email"]');
                if (emailFieldReset) {
                    emailFieldReset.value = '';
                    emailFieldReset.classList.remove('error', 'valid-email', 'touched');
                    emailFieldReset.style.borderColor = '#e2e8f0'; // Default grey border
                    emailFieldReset.style.backgroundColor = '#ffffff'; // Default white background
                }
                
                // Hide contact methods
                const contactWrapper = document.getElementById('contactMethodsWrapper');
                const phoneOption = document.getElementById('phoneOption');
                if (contactWrapper) contactWrapper.classList.remove('show');
                if (phoneOption) phoneOption.classList.remove('show');
                
                // Clear all errors and touched states
                document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
                document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
                document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
                document.querySelectorAll('.touched').forEach(el => el.classList.remove('touched'));
                document.querySelectorAll('.consent-error').forEach(el => el.classList.remove('show'));
                
                // Show survey, hide thank you
                const thankYou = document.getElementById('thankYou');
                const surveyContainer = document.querySelector('.survey-container');
                if (thankYou) thankYou.classList.remove('show');
                if (surveyContainer) surveyContainer.style.display = 'block';
                
                // Reset countdown
                const countdownEl = document.getElementById('countdown');
                if (countdownEl) countdownEl.textContent = CONFIG.AUTO_RESTART_TIME;
                
                // Re-setup field validation for new session
                setupFieldValidation();
            } catch (error) {
                console.error('Survey reset failed:', error);
                // Force page reload as fallback
                window.location.reload();
            }
        }

        // Setup new survey button
        function setupNewSurveyButton() {
            try {
                const newSurveyBtn = document.getElementById('newSurveyBtn');
                if (newSurveyBtn) {
                    newSurveyBtn.addEventListener('click', resetSurvey);
                }
            } catch (error) {
                console.error('New survey button setup failed:', error);
            }
        }

        // Initialize everything when DOM is ready
        function initializeApp() {
            try {
                setupDateField();
                setupFieldValidation();
                setupNavigation();
                setupContactPreferences();
                setupPhoneAndEmailFields();
                setupSubmitHandler();
                setupNewSurveyButton();
                
                console.log('Survey form initialized successfully');
                console.log('Backend integration required at:', CONFIG.API_BASE_URL + CONFIG.SUBMIT_ENDPOINT);
            } catch (error) {
                console.error('App initialization failed:', error);
            }
        }

        // Start initialization when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp);
        } else {
            initializeApp();
        }
    
// Inline the Supabase configuration for immediate availability
const SUPABASE_URL = 'https://vqixnccfatvvythjcwtg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxaXhuY2NmYXR2dnl0aGpjd3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0ODMyNDMsImV4cCI6MjA2OTA1OTI0M30.WCJRdZ479ZdiLo1CvN4iEftOFm5Uy3YCseY5PcAxdfE';


// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Survey submission handler
async function submitSurvey(formData) {
    try {
        // Prepare survey data
        const surveyData = {
            // Basic Information
            patient_name: formData.get('patient_name'),
            patient_email: formData.get('patient_email'),
            patient_phone: formData.get('patient_phone') || null,
            visit_date: formData.get('visit_date'),
            clinic_location: formData.get('clinic_location'),
            
            // Overall Experience
            overall_satisfaction: formData.get('overall_satisfaction'),
            visit_type: formData.get('visit_type'),
            
            // Reception Staff
            reception_satisfaction: formData.get('reception_satisfaction'),
            registration_smooth: formData.get('registration_smooth'),
            reception_comments: formData.get('reception_comments') || null,
            
            // Nursing Staff
            nursing_professionalism: formData.get('nursing_professionalism'),
            nursing_prompt: formData.get('nursing_prompt'),
            nursing_comments: formData.get('nursing_comments') || null,
            
            // Doctor Consultation
            doctor_satisfaction: formData.get('doctor_satisfaction'),
            doctor_listening: formData.get('doctor_listening'),
            doctor_explanation: formData.get('doctor_explanation'),
            doctor_comments: formData.get('doctor_comments') || null,
            
            // Clinic Environment
            clinic_cleanliness: formData.get('clinic_cleanliness'),
            waiting_time_acceptable: formData.get('waiting_time_acceptable'),
            environment_comments: formData.get('environment_comments') || null,
            
            // Additional Feedback
            liked_most: formData.get('liked_most') || null,
            areas_improve: formData.get('areas_improve') || null,
            
            // Recommendation
            recommendation_likelihood: formData.get('recommendation_likelihood'),
            recommendation_comments: formData.get('recommendation_comments') || null,
            
            // Contact Preferences
            want_contact: formData.get('want_contact'),
            contact_preference: [],
            
            // Consent
            consent_feedback_use: formData.get('consent_feedback_use'),
            
            // Metadata
            created_at: new Date().toISOString()
        };

        // Handle contact preferences array
        formData.getAll('contact_preference[]').forEach(pref => {
            surveyData.contact_preference.push(pref);
        });

        // Submit survey to database
        const { data, error } = await supabase
            .from('surveys')
            .insert([surveyData])
            .select()
            .single();

        if (error) throw error;

        // Create follow-up task if requested
        if (surveyData.want_contact === 'yes' && data) {
            // Check if follow-up already exists
            const { data: existingFollowUp } = await supabase
                .from('follow_ups')
                .select('id')
                .eq('survey_id', data.id)
                .single();
            
            if (!existingFollowUp) {
                // Create follow-up task
                const followUpData = {
                    survey_id: data.id,
                    patient_name: surveyData.patient_name,
                    patient_email: surveyData.patient_email,
                    patient_phone: surveyData.patient_phone,
                    clinic_location: surveyData.clinic_location,
                    contact_preference: surveyData.contact_preference, // This is already an array
                    priority: surveyData.overall_satisfaction === 'dissatisfied' ? 'high' : 
                            surveyData.overall_satisfaction === 'very_satisfied' ? 'low' : 'medium',
                    status: 'pending',
                    created_at: new Date().toISOString()
                };

                const { error } = await supabase
                    .from('follow_ups')
                    .insert([followUpData]);

                if (error && !error.message.includes('duplicate key')) {
                    console.error('Follow-up creation error:', error);
                }
            }
        }


        return { success: true, data };

    } catch (error) {
        console.error('Survey submission error:', error);
        return { success: false, error: error.message };
    }
}

// Create follow-up task
async function createFollowUpTask(surveyData) {
    try {
        // Determine priority based on satisfaction
        let priority = 'medium';
        if (surveyData.overall_satisfaction === 'dissatisfied') {
            priority = 'high';
        } else if (surveyData.overall_satisfaction === 'very_satisfied') {
            priority = 'low';
        }

        const followUpData = {
            survey_id: surveyData.id,
            patient_name: surveyData.patient_name,
            patient_email: surveyData.patient_email,
            patient_phone: surveyData.patient_phone,
            clinic_location: surveyData.clinic_location,
            contact_preference: surveyData.contact_preference,
            priority: priority,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('follow_ups')
            .insert([followUpData]);

        if (error) {
            console.error('Follow-up creation error:', error);
        }

    } catch (error) {
        console.error('Follow-up task error:', error);
    }
}

// Check for duplicate submissions (optional)
async function checkDuplicateSubmission(email, visitDate) {
    try {
        const { data, error } = await supabase
            .from('surveys')
            .select('id')
            .eq('patient_email', email)
            .eq('visit_date', visitDate)
            .limit(1);

        if (error) throw error;
        
        return data && data.length > 0;

    } catch (error) {
        console.error('Duplicate check error:', error);
        return false;
    }
}

// Export the API
window.surveyAPI = {
    submitSurvey,
    checkDuplicateSubmission
};

// Wait for all scripts to load
window.addEventListener('load', function() {
    // Check if Supabase is loaded
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase SDK not loaded!');
        alert('Survey system not properly configured. Please contact support.');
        return;
    }
    
    // Check if survey API is loaded
    if (typeof window.surveyAPI === 'undefined') {
        console.error('Survey API not loaded!');
        alert('Survey system not properly configured. Please contact support.');
        return;
    }
    
    console.log('Survey system loaded successfully');
});