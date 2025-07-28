    // Supabase configuration - REPLACE WITH YOUR ACTUAL VALUES
    const SUPABASE_URL = 'https://vqixnccfatvvythjcwtg.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxaXhuY2NmYXR2dnl0aGpjd3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0ODMyNDMsImV4cCI6MjA2OTA1OTI0M30.WCJRdZ479ZdiLo1CvN4iEftOFm5Uy3YCseY5PcAxdfE';

    // Initialize Supabase client
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Configuration and clinic mapping
    const clinicMap = {
        'clinic1': 'UAEU Main Campus Clinic - Al Ain',
        'clinic2': 'UAEU Medical Campus Clinic - Al Ain',
        'clinic3': 'EGA Dubai Clinic - Dubai',
        'clinic4': 'EGA Abu Dhabi Clinic - Abu Dhabi',
        'clinic5': 'UAEU Al Ain Campus Clinic - Al Ain',
    };

    // Satisfaction scale mapping for calculations
    const satisfactionScales = {
        overall: {
            'dissatisfied': 2,
            'satisfied': 4,
            'very_satisfied': 5
        },
        detailed: {
            'very_dissatisfied': 1,
            'dissatisfied': 2,
            'neutral': 3,
            'satisfied': 4,
            'very_satisfied': 5
        },
        nursing: {
            'poor': 1,
            'fair': 2,
            'good': 3,
            'excellent': 4
        },
        recommendation: {
            'very_unlikely': 1,
            'unlikely': 2,
            'neutral': 3,
            'likely': 4,
            'very_likely': 5
        }
    };

    // Formatting functions
    function formatSatisfaction(satisfaction) {
        const formats = {
            'very_satisfied': 'Very Satisfied',
            'satisfied': 'Satisfied',
            'neutral': 'Neutral',
            'dissatisfied': 'Dissatisfied',
            'very_dissatisfied': 'Very Dissatisfied'
        };
        return formats[satisfaction] || satisfaction;
    }

    function formatProfessionalism(level) {
        const formats = {
            'poor': 'Poor',
            'fair': 'Fair',
            'good': 'Good',
            'excellent': 'Excellent'
        };
        return formats[level] || level;
    }

    function formatRecommendation(likelihood) {
        const formats = {
            'very_unlikely': 'Very Unlikely',
            'unlikely': 'Unlikely',
            'neutral': 'Neutral',
            'likely': 'Likely',
            'very_likely': 'Very Likely'
        };
        return formats[likelihood] || likelihood;
    }

    function formatYesNo(value) {
        return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value;
    }

    // Main dashboard class
    class AdminDashboard {
        constructor() {
            this.currentUser = null;
            this.charts = {};
            this.filteredData = [];
            this.sortState = {
                recent: { column: 'created_at', direction: 'desc' },
                surveys: { column: 'created_at', direction: 'desc' },
                followups: { column: 'created_at', direction: 'desc' },
                users: { column: 'created_at', direction: 'desc' }
            };
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.checkAuthStatus();
        }

        setupEventListeners() {
            // Login form
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }

            // User form
            const userForm = document.getElementById('userForm');
            if (userForm) {
                userForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleAddUser();
                });
            }

            // Logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.handleLogout());
            }

            // Tab navigation
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
            });

            // Sorting headers
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('sortable')) {
                    this.handleSort(e.target);
                }
            });
        }

        async checkAuthStatus() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    this.showAuth();
                    return;
                }

                // Get admin details
                const { data: adminUser } = await supabase
                    .from('admin_users')
                    .select('*')
                    .eq('email', user.email)
                    .eq('status', 'active')
                    .single();

                if (!adminUser) {
                    await supabase.auth.signOut();
                    this.showAuth();
                    return;
                }

                this.currentUser = adminUser;
                this.showDashboard();
                this.loadDashboardData();

            } catch (error) {
                console.error('Auth check error:', error);
                this.showAuth();
            }
        }

        async handleLogin() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                // Sign in with Supabase Auth
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (authError) throw authError;

                // Get admin user details
                const { data: adminUser, error: adminError } = await supabase
                    .from('admin_users')
                    .select('*')
                    .eq('email', email)
                    .eq('status', 'active')
                    .single();

                if (adminError || !adminUser) {
                    await supabase.auth.signOut();
                    this.showError('Access denied. Not an active admin user.');
                    return;
                }

                this.currentUser = adminUser;
                localStorage.setItem('dashboardUser', JSON.stringify(adminUser));
                this.showDashboard();
                this.loadDashboardData();
                
            } catch (error) {
                console.error('Login error:', error);
                this.showError(error.message || 'Invalid credentials');
            }
        }

        async handleLogout() {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                
                localStorage.removeItem('dashboardUser');
                this.currentUser = null;
                this.showAuth();
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        async handleAddUser() {
            const name = document.getElementById('newUserName').value;
            const email = document.getElementById('newUserEmail').value;
            const password = document.getElementById('newUserPassword').value;
            const clinic = document.getElementById('newUserClinic').value;

            try {
                // Step 1: Create user in Supabase Auth using signUp
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            name: name
                        }
                    }
                });

                if (authError) throw authError;

                // Step 2: Add to admin_users table
                const { data, error } = await supabase
                    .from('admin_users')
                    .insert({
                        name: name,
                        email: email,
                        role: 'admin',
                        assigned_clinic: clinic,
                        status: 'active',
                        created_by: this.currentUser.id
                    })
                    .select()
                    .single();

                if (error) throw error;

                document.getElementById('userForm').reset();
                this.loadUsersData();
                alert('User added successfully! They can now login with their credentials.');
                
            } catch (error) {
                console.error('Add user error:', error);
                
                // If auth succeeded but admin_users failed, we should clean up
                if (error.message && error.message.includes('duplicate key')) {
                    alert('This email already exists in the admin users table');
                } else {
                    alert('Failed to add user: ' + error.message);
                }
            }
        }
        showAuth() {
            document.getElementById('authScreen').style.display = 'flex';
            document.getElementById('dashboard').classList.remove('active');
        }

        showDashboard() {
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            
            // Update user info
            document.getElementById('userName').textContent = this.currentUser.name;
            const roleElement = document.getElementById('userRole');
            roleElement.textContent = this.currentUser.role === 'super_admin' ? 'Super Admin' : 'Admin';
            
            if (this.currentUser.role === 'super_admin') {
                roleElement.classList.add('super-admin');
                document.querySelector('[data-tab="users"]').style.display = 'block';
            } else {
                roleElement.classList.remove('super-admin');
                document.querySelector('[data-tab="users"]').style.display = 'none';
            }

            this.setupClinicFilterRestrictions();
        }

        setupClinicFilterRestrictions() {
            const clinicFilter = document.getElementById('clinicFilter');
            const newUserClinic = document.getElementById('newUserClinic');
            const followUpClinicFilter = document.getElementById('followUpClinicFilter');
            
            if (this.currentUser.role === 'admin') {
                clinicFilter.value = this.currentUser.assigned_clinic;
                clinicFilter.disabled = true;
                
                if (newUserClinic) {
                    newUserClinic.value = this.currentUser.assigned_clinic;
                    newUserClinic.disabled = true;
                }
                
                if (followUpClinicFilter) {
                    followUpClinicFilter.value = this.currentUser.assigned_clinic;
                    followUpClinicFilter.disabled = true;
                }
            } else {
                clinicFilter.disabled = false;
                if (newUserClinic) {
                    newUserClinic.disabled = false;
                }
                if (followUpClinicFilter) {
                    followUpClinicFilter.disabled = false;
                }
            }
        }
        
        
        
        switchTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName).classList.add('active');

            // Load tab-specific data
            this.loadTabData(tabName);
        }

        async loadTabData(tabName) {
            switch (tabName) {
                case 'overview':
                    await this.loadOverviewData();
                    break;
                case 'surveys':
                    await this.loadSurveysData();
                    break;
                case 'analytics':
                    await this.loadAnalyticsData();
                    break;
                case 'follow-ups':
                    await this.loadFollowUpsData();
                    break;
                case 'users':
                    await this.loadUsersData();
                    break;
            }
        }

        loadDashboardData() {
            this.loadOverviewData();
        }

        async loadOverviewData() {
            try {
                const today = new Date().toISOString().split('T')[0];
                let baseQuery = supabase.from('surveys').select('*');

                // Apply clinic filter for non-super admins
                if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
                    baseQuery = baseQuery.eq('clinic_location', this.currentUser.assigned_clinic);
                }

                // Get today's surveys
                const { data: todaySurveys, error: todayError } = await baseQuery
                    .gte('created_at', today + 'T00:00:00')
                    .lte('created_at', today + 'T23:59:59');

                if (todayError) throw todayError;

                // Get all surveys for calculations
                let allQuery = supabase.from('surveys').select('*');
                if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
                    allQuery = allQuery.eq('clinic_location', this.currentUser.assigned_clinic);
                }
                
                const { data: allSurveys, error: allError } = await allQuery;
                if (allError) throw allError;

                // Calculate statistics
                const totalToday = todaySurveys?.length || 0;
                
                // Calculate average satisfaction
                const avgSatisfaction = allSurveys?.length > 0 
                    ? (allSurveys.reduce((sum, s) => sum + (satisfactionScales.overall[s.overall_satisfaction] || 3), 0) / allSurveys.length).toFixed(1)
                    : '0.0';

                // Count pending follow-ups
                let followUpQuery = supabase
                    .from('follow_ups')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');
                    
                if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
                    followUpQuery = followUpQuery.eq('clinic_location', this.currentUser.assigned_clinic);
                }
                
                const { count: pendingCount } = await followUpQuery;

                // Count dissatisfied patients
                const dissatisfiedCount = allSurveys?.filter(s => s.overall_satisfaction === 'dissatisfied').length || 0;

                // Update UI
                document.getElementById('totalSurveys').textContent = totalToday;
                document.getElementById('avgSatisfaction').textContent = avgSatisfaction;
                document.getElementById('pendingFollowUps').textContent = pendingCount || 0;
                document.getElementById('dissatisfiedCount').textContent = dissatisfiedCount;

                // Update trends - Fix the selectors
                const statCards = document.querySelectorAll('.stat-card');
                
                // Update Total Surveys trend
                if (statCards[0]) {
                    const trendEl = statCards[0].querySelector('.trend');
                    if (trendEl) {
                        trendEl.textContent = totalToday > 0 ? '↑ Active today' : 'No surveys yet today';
                        trendEl.className = totalToday > 0 ? 'trend up' : 'trend';
                    }
                }
                
                // Update Average Satisfaction trend
                if (statCards[1]) {
                    const trendEl = statCards[1].querySelector('.trend');
                    if (trendEl) {
                        const avgNum = parseFloat(avgSatisfaction);
                        trendEl.textContent = avgNum >= 4 ? '↑ Excellent' : avgNum >= 3 ? '→ Good' : '↓ Needs attention';
                        trendEl.className = avgNum >= 4 ? 'trend up' : avgNum >= 3 ? 'trend' : 'trend down';
                    }
                }
                
                // Update Pending Follow-ups trend
                if (statCards[2]) {
                    const trendEl = statCards[2].querySelector('.trend');
                    if (trendEl) {
                        trendEl.textContent = pendingCount > 0 ? '⚠ Need attention' : '✓ All clear';
                        trendEl.className = pendingCount > 0 ? 'trend down' : 'trend up';
                    }
                }
                
                // Update Dissatisfied Patients trend
                if (statCards[3]) {
                    const trendEl = statCards[3].querySelector('.trend');
                    if (trendEl) {
                        trendEl.textContent = dissatisfiedCount > 0 ? '↓ Require follow-up' : '✓ Great job!';
                        trendEl.className = dissatisfiedCount > 0 ? 'trend down' : 'trend up';
                    }
                }
                
                // Load recent surveys table
                await this.loadRecentSurveys();
                
            } catch (error) {
                console.error('Failed to load overview data:', error);
                // Show zeros on error
                document.getElementById('totalSurveys').textContent = '0';
                document.getElementById('avgSatisfaction').textContent = '0.0';
                document.getElementById('pendingFollowUps').textContent = '0';
                document.getElementById('dissatisfiedCount').textContent = '0';
                
                // Update trends to show error state
                document.querySelectorAll('.stat-card .trend').forEach(el => {
                    el.textContent = 'Error loading data';
                    el.className = 'trend';
                });
            }
        }
        async loadRecentSurveys() {
            try {
                let query = supabase
                    .from('surveys')
                    .select('*')
                    .order(this.sortState.recent.column, { ascending: this.sortState.recent.direction === 'asc' })
                    .limit(10);

                // Apply clinic filter for non-super admins
                if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
                    query = query.eq('clinic_location', this.currentUser.assigned_clinic);
                }

                const { data, error } = await query;
                if (error) throw error;

                const tableBody = document.getElementById('recentSurveysTable');
                
                if (!data || data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b;">No recent surveys found</td></tr>';
                    return;
                }

                tableBody.innerHTML = data.map(survey => `
                    <tr>
                        <td>${survey.patient_name}</td>
                        <td>
                            ${survey.patient_email}<br>
                            <small style="color: #64748b;">${survey.patient_phone || 'No phone'}</small>
                        </td>
                        <td>${clinicMap[survey.clinic_location] || survey.clinic_location}</td>
                        <td>
                            <span class="status-badge status-${survey.overall_satisfaction === 'very_satisfied' ? 'high' : 
                                survey.overall_satisfaction === 'satisfied' ? 'medium' : 'low'}">
                                ${formatSatisfaction(survey.overall_satisfaction)}
                            </span>
                        </td>
                        <td>${new Date(survey.visit_date).toLocaleDateString()}</td>
                        <td>${new Date(survey.created_at).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="viewSurvey('${survey.id}')">View</button>
                        </td>
                    </tr>
                `).join('');
                
            } catch (error) {
                console.error('Failed to load recent surveys:', error);
                const tableBody = document.getElementById('recentSurveysTable');
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc2626;">Error loading surveys</td></tr>';
            }
        }

        async loadSurveysData() {
            try {
                // Get filter values
                const clinicFilter = document.getElementById('clinicFilter').value;
                const dateRangeFilter = document.getElementById('dateRangeFilter').value;
                const satisfactionFilter = document.getElementById('satisfactionFilter').value;
                const searchFilter = document.getElementById('searchFilter').value.toLowerCase().trim();

                let query = supabase.from('surveys').select('*');

                // Apply clinic filter
                if (clinicFilter) {
                    query = query.eq('clinic_location', clinicFilter);
                } else if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
                    query = query.eq('clinic_location', this.currentUser.assigned_clinic);
                }

                // Apply date range filter
                const now = new Date();
                switch (dateRangeFilter) {
                    case 'today':
                        const today = new Date().toISOString().split('T')[0];
                        query = query.gte('created_at', today + 'T00:00:00');
                        break;
                    case 'week':
                        const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
                        query = query.gte('created_at', weekAgo);
                        break;
                    case 'month':
                        const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
                        query = query.gte('created_at', monthAgo);
                        break;
                }

                // Apply satisfaction filter
                if (satisfactionFilter) {
                    query = query.eq('overall_satisfaction', satisfactionFilter);
                }

                // Apply search filter using Supabase's OR and ilike
                if (searchFilter) {
                    query = query.or(`patient_name.ilike.%${searchFilter}%,patient_email.ilike.%${searchFilter}%,patient_phone.ilike.%${searchFilter}%`);
                }

                // Apply sorting
                query = query.order(this.sortState.surveys.column, { ascending: this.sortState.surveys.direction === 'asc' });

                const { data, error } = await query;
                if (error) throw error;

                const tableBody = document.getElementById('allSurveysTable');
                
                if (!data || data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #64748b;">No surveys found</td></tr>';
                    return;
                }

                tableBody.innerHTML = data.map(survey => `
                    <tr>
                        <td>${survey.id.substring(0, 8)}...</td>
                        <td>${survey.patient_name}</td>
                        <td>
                            ${survey.patient_email}<br>
                            <small style="color: #64748b;">${survey.patient_phone || 'No phone'}</small>
                        </td>
                        <td>${clinicMap[survey.clinic_location] || survey.clinic_location}</td>
                        <td>
                            <span class="status-badge status-${survey.overall_satisfaction === 'very_satisfied' ? 'high' : 
                                survey.overall_satisfaction === 'satisfied' ? 'medium' : 'low'}">
                                ${formatSatisfaction(survey.overall_satisfaction)}
                            </span>
                        </td>
                        <td>${new Date(survey.visit_date).toLocaleDateString()}</td>
                        <td>
                            <span class="status-badge status-${survey.want_contact === 'yes' ? 'pending' : 'completed'}">
                                ${survey.want_contact === 'yes' ? 'Requested' : 'Not Requested'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="viewSurvey('${survey.id}')">View</button>
                        </td>
                    </tr>
                `).join('');
                
            } catch (error) {
                console.error('Failed to load surveys:', error);
                const tableBody = document.getElementById('allSurveysTable');
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Error loading surveys</td></tr>';
            }
        }
        async loadAnalyticsData() {
            try {
                let baseQuery = supabase.from('surveys').select('*');

                // Apply clinic filter for non-super admins
                if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
                    baseQuery = baseQuery.eq('clinic_location', this.currentUser.assigned_clinic);
                }

                // Get last 30 days of data
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const { data: surveys, error } = await baseQuery
                    .gte('created_at', thirtyDaysAgo.toISOString());

                if (error) throw error;

                // Calculate metrics
                const totalResponses = surveys?.length || 0;
                
                const avgOverall = totalResponses > 0
                    ? (surveys.reduce((sum, s) => sum + (satisfactionScales.overall[s.overall_satisfaction] || 3), 0) / totalResponses).toFixed(1)
                    : '0.0';

                const satisfiedCount = surveys?.filter(s => 
                    s.overall_satisfaction === 'satisfied' || s.overall_satisfaction === 'very_satisfied'
                ).length || 0;

                const satisfactionRate = totalResponses > 0
                    ? Math.round((satisfiedCount / totalResponses) * 100)
                    : 0;

                const followUpRequests = surveys?.filter(s => s.want_contact === 'yes').length || 0;
                const followUpRate = totalResponses > 0
                    ? Math.round((followUpRequests / totalResponses) * 100)
                    : 0;

                // Update metrics
                document.getElementById('totalResponsesMetric').textContent = totalResponses;
                document.getElementById('avgOverallMetric').textContent = avgOverall;
                document.getElementById('satisfactionRateMetric').textContent = `${satisfactionRate}%`;
                document.getElementById('responseRateMetric').textContent = `${followUpRate}%`;

                // Create charts
                this.createCharts(surveys || []);
                
            } catch (error) {
                console.error('Failed to load analytics:', error);
                // Show default values on error
                document.getElementById('totalResponsesMetric').textContent = '0';
                document.getElementById('avgOverallMetric').textContent = '0.0';
                document.getElementById('satisfactionRateMetric').textContent = '0%';
                document.getElementById('responseRateMetric').textContent = '0%';
            }
        }

        createCharts(surveys) {
            // Destroy existing charts
            Object.values(this.charts).forEach(chart => chart?.destroy());
            this.charts = {};

            if (!surveys || surveys.length === 0) {
                this.createEmptyCharts();
                return;
            }

            // Satisfaction Trends (Last 7 Days)
            const last7Days = {};
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateKey = date.toLocaleDateString();
                last7Days[dateKey] = [];
            }

            surveys.forEach(survey => {
                const dateKey = new Date(survey.created_at).toLocaleDateString();
                if (last7Days[dateKey]) {
                    last7Days[dateKey].push(survey);
                }
            });

            const ctx1 = document.getElementById('satisfactionChart');
            if (ctx1) {
                this.charts.satisfaction = new Chart(ctx1, {
                    type: 'line',
                    data: {
                        labels: Object.keys(last7Days),
                        datasets: [{
                            label: 'Average Satisfaction',
                            data: Object.values(last7Days).map(daySurveys => {
                                if (daySurveys.length === 0) return 0;
                                const sum = daySurveys.reduce((acc, s) => 
                                    acc + (satisfactionScales.overall[s.overall_satisfaction] || 3), 0
                                );
                                return (sum / daySurveys.length).toFixed(1);
                            }),
                            borderColor: '#2c5aa0',
                            backgroundColor: 'rgba(44, 90, 160, 0.1)',
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 5
                            }
                        }
                    }
                });
            }

            // Clinic Performance
            const clinicStats = {};
            surveys.forEach(survey => {
                const clinic = clinicMap[survey.clinic_location] || survey.clinic_location;
                if (!clinicStats[clinic]) {
                    clinicStats[clinic] = { total: 0, satisfied: 0 };
                }
                clinicStats[clinic].total++;
                if (survey.overall_satisfaction === 'satisfied' || survey.overall_satisfaction === 'very_satisfied') {
                    clinicStats[clinic].satisfied++;
                }
            });

            const ctx2 = document.getElementById('clinicChart');
            if (ctx2) {
                this.charts.clinic = new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(clinicStats),
                        datasets: [{
                            label: 'Satisfaction Rate (%)',
                            data: Object.values(clinicStats).map(stats => 
                                Math.round((stats.satisfied / stats.total) * 100)
                            ),
                            backgroundColor: '#10b981'
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100
                            }
                        }
                    }
                });
            }

            // Overall Rating Distribution
            const ratingCounts = {
                'Very Satisfied': surveys.filter(s => s.overall_satisfaction === 'very_satisfied').length,
                'Satisfied': surveys.filter(s => s.overall_satisfaction === 'satisfied').length,
                'Dissatisfied': surveys.filter(s => s.overall_satisfaction === 'dissatisfied').length
            };

            const ctx4 = document.getElementById('ratingChart');
            if (ctx4) {
                this.charts.rating = new Chart(ctx4, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(ratingCounts),
                        datasets: [{
                            data: Object.values(ratingCounts),
                            backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
                        }]
                    },
                    options: {
                        responsive: true
                    }
                });
            }

            // Create remaining empty charts for now
            ['departmentChart', 'visitTypeChart', 'serviceQualityChart', 
             'recommendationChart', 'followupBySatisfactionChart'].forEach(chartId => {
                const ctx = document.getElementById(chartId);
                if (ctx && !this.charts[chartId]) {
                    this.charts[chartId] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ['No Data'],
                            datasets: [{
                                label: 'Coming Soon',
                                data: [0],
                                backgroundColor: '#e5e7eb'
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: {
                                    display: false
                                }
                            }
                        }
                    });
                }
            });
        }

        createEmptyCharts() {
            const chartIds = [
                'satisfactionChart',
                'clinicChart', 
                'departmentChart',
                'ratingChart',
                'visitTypeChart',
                'serviceQualityChart',
                'recommendationChart',
                'followupBySatisfactionChart'
            ];

            chartIds.forEach(chartId => {
                const ctx = document.getElementById(chartId);
                if (ctx) {
                    this.charts[chartId] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ['No Data'],
                            datasets: [{
                                label: 'No Data Available',
                                data: [0],
                                backgroundColor: '#e5e7eb'
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: {
                                    display: false
                                }
                            }
                        }
                    });
                }
            });
        }

        async loadFollowUpsData() {
    try {
        // Get filter values
        const statusFilter = document.getElementById('followUpStatusFilter')?.value || '';
        const clinicFilter = document.getElementById('followUpClinicFilter')?.value || '';
        const priorityFilter = document.getElementById('followUpPriorityFilter')?.value || '';

        let query = supabase
            .from('follow_ups')
            .select(`
                *,
                surveys!inner(
                    overall_satisfaction
                )
            `);

        // Handle sorting - special case for overall_satisfaction
        if (this.sortState.followups.column === 'overall_satisfaction') {
            // Sort by created_at instead since we can't sort by joined table columns directly
            query = query.order('created_at', { ascending: this.sortState.followups.direction === 'asc' });
        } else {
            query = query.order(this.sortState.followups.column, { ascending: this.sortState.followups.direction === 'asc' });
        }

        // Apply status filter
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        // Apply clinic filter
        if (clinicFilter) {
            query = query.eq('clinic_location', clinicFilter);
        } else if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
            query = query.eq('clinic_location', this.currentUser.assigned_clinic);
        }

        // Apply priority filter
        if (priorityFilter) {
            query = query.eq('priority', priorityFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        // If sorting by overall_satisfaction, sort the data in JavaScript
        if (this.sortState.followups.column === 'overall_satisfaction' && data) {
            const satisfactionOrder = { 'dissatisfied': 1, 'satisfied': 2, 'very_satisfied': 3 };
            data.sort((a, b) => {
                const aVal = satisfactionOrder[a.surveys?.overall_satisfaction] || 0;
                const bVal = satisfactionOrder[b.surveys?.overall_satisfaction] || 0;
                return this.sortState.followups.direction === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        const tableBody = document.getElementById('followUpsTable');
        
        // Rest of your code remains the same...
                
                if (!data || data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #64748b;">No follow-up tasks found</td></tr>';
                    return;
                }

                tableBody.innerHTML = data.map(followUp => `
                    <tr>
                        <td>${followUp.patient_name}</td>
                        <td>
                            ${followUp.patient_email}<br>
                            <small style="color: #64748b;">${followUp.patient_phone || 'No phone'}</small>
                        </td>
                        <td>${followUp.contact_preference?.join(', ') || 'Any'}</td>
                        <td>${clinicMap[followUp.clinic_location] || followUp.clinic_location}</td>
                        <td>
                            <span class="status-badge status-${followUp.priority}">
                                ${followUp.priority.toUpperCase()}
                            </span>
                        </td>
                        <td>
                            <span class="status-badge status-${followUp.status === 'pending' ? 'pending' : 'completed'}">
                                ${followUp.status.toUpperCase()}
                            </span>
                        </td>
                        <td>
                            <span class="status-badge status-${followUp.surveys?.overall_satisfaction === 'very_satisfied' ? 'high' : 
                                followUp.surveys?.overall_satisfaction === 'satisfied' ? 'medium' : 'low'}">
                                ${formatSatisfaction(followUp.surveys?.overall_satisfaction || 'Unknown')}
                            </span>
                        </td>
                        <td>${new Date(followUp.created_at).toLocaleString()}</td>
                        <td>
                            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                <button class="btn btn-sm btn-primary" onclick="viewSurvey('${followUp.survey_id}')">View Survey</button>
                                ${followUp.status === 'pending' ? 
                                    `<button class="btn btn-sm btn-success" onclick="completeFollowUp('${followUp.id}')">Complete</button>` :
                                    '<span style="color: #10b981; align-self: center;">✓ Done</span>'
                                }
                            </div>
                        </td>
                    </tr>
                `).join('');
                
            } catch (error) {
                console.error('Failed to load follow-ups:', error);
                const tableBody = document.getElementById('followUpsTable');
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #dc2626;">Error loading follow-ups</td></tr>';
            }
        }
        async loadUsersData() {
            try {
                if (this.currentUser?.role !== 'super_admin') {
                    document.getElementById('usersTable').innerHTML = 
                        '<tr><td colspan="7" style="text-align: center; color: #dc2626;">Unauthorized</td></tr>';
                    return;
                }

                const { data, error } = await supabase
                    .from('admin_users')
                    .select('*')
                    .order(this.sortState.users.column, { ascending: this.sortState.users.direction === 'asc' });


                if (error) throw error;

                const tableBody = document.getElementById('usersTable');
                
                if (!data || data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b;">No users found</td></tr>';
                    return;
                }

                tableBody.innerHTML = data.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>
                            <span class="role-badge ${user.role === 'super_admin' ? 'super-admin' : ''}">
                                ${user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                            </span>
                        </td>
                        <td>${user.assigned_clinic ? clinicMap[user.assigned_clinic] : 'All Clinics'}</td>
                        <td>
                            <span class="status-badge status-${user.status === 'active' ? 'active' : 'inactive'}">
                                ${user.status.toUpperCase()}
                            </span>
                        </td>
                        <td>${new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                            ${user.id !== this.currentUser.id && user.role !== 'super_admin' ? 
                                `<div style="display: flex; gap: 5px;">
                                    ${user.status === 'active' ? 
                                        `<button class="btn btn-sm btn-danger" onclick="deactivateUser('${user.id}')">Deactivate</button>` :
                                        `<button class="btn btn-sm btn-success" onclick="activateUser('${user.id}')">Activate</button>`
                                    }
                                </div>` :
                                '-'
                            }
                        </td>
                    </tr>
                `).join('');
            } catch (error) {
                console.error('Failed to load users:', error);
                const tableBody = document.getElementById('usersTable');
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #dc2626;">Error loading users</td></tr>';
            }
        }

        handleSort(header) {
            // Implementation remains the same
            const column = header.dataset.sort;
            const table = header.closest('table');
            const tableId = table.querySelector('tbody').id;
            
            let sortKey = '';
            if (tableId === 'recentSurveysTable') sortKey = 'recent';
            else if (tableId === 'allSurveysTable') sortKey = 'surveys';
            else if (tableId === 'followUpsTable') sortKey = 'followups';
            else if (tableId === 'usersTable') sortKey = 'users';
            
            if (this.sortState[sortKey].column === column) {
                this.sortState[sortKey].direction = 
                    this.sortState[sortKey].direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortState[sortKey].column = column;
                this.sortState[sortKey].direction = 'desc';
            }
            
            table.querySelectorAll('th.sortable').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
            });
            
            header.classList.add(this.sortState[sortKey].direction === 'asc' ? 'sort-asc' : 'sort-desc');
            
            switch (sortKey) {
                case 'recent':
                    this.loadRecentSurveys();
                    break;
                case 'surveys':
                    this.loadSurveysData();
                    break;
                case 'followups':
                    this.loadFollowUpsData();
                    break;
                case 'users':
                    this.loadUsersData();
                    break;
            }
        }

        showError(message) {
            const errorDiv = document.getElementById('authError');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => errorDiv.style.display = 'none', 3000);
        }

        refreshData() {
            this.loadDashboardData();
            console.log('Data refreshed at', new Date().toLocaleTimeString());
        }

        // Add these calculation helper methods to your AdminDashboard class
calculateAverageOverallSatisfaction(surveys) {
    if (!surveys || surveys.length === 0) return '0.0';
    
    const total = surveys.reduce((sum, s) => sum + (satisfactionScales.overall[s.overall_satisfaction] || 3), 0);
    return (total / surveys.length).toFixed(1);
}

calculateAverageDetailedSatisfaction(surveys, field) {
    if (!surveys || surveys.length === 0) return 0;
    
    const total = surveys.reduce((sum, s) => sum + (satisfactionScales.detailed[s[field]] || 3), 0);
    return parseFloat((total / surveys.length).toFixed(1));
}

calculateAverageNursingProfessionalism(surveys) {
    if (!surveys || surveys.length === 0) return 0;
    
    const total = surveys.reduce((sum, s) => sum + (satisfactionScales.nursing[s.nursing_professionalism] || 2), 0);
    // Convert to 5-point scale for consistency
    return parseFloat(((total / surveys.length) * 5 / 4).toFixed(1));
}

calculateYesPercentage(surveys, field) {
    if (!surveys || surveys.length === 0) return 0;
    
    const yesCount = surveys.filter(s => s[field] === 'yes').length;
    return Math.round((yesCount / surveys.length) * 100);
}

// Update the loadAnalyticsData method
async loadAnalyticsData() {
    try {
        let baseQuery = supabase.from('surveys').select('*');

        // Apply clinic filter for non-super admins
        if (this.currentUser?.role === 'admin' && this.currentUser?.assigned_clinic) {
            baseQuery = baseQuery.eq('clinic_location', this.currentUser.assigned_clinic);
        }

        // Get last 30 days of data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: surveys, error } = await baseQuery
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (error) throw error;

        // Calculate metrics using proper methods
        const totalResponses = surveys?.length || 0;
        
        const avgOverall = this.calculateAverageOverallSatisfaction(surveys || []);

        const satisfiedCount = surveys?.filter(s => 
            s.overall_satisfaction === 'satisfied' || s.overall_satisfaction === 'very_satisfied'
        ).length || 0;

        const satisfactionRate = totalResponses > 0
            ? Math.round((satisfiedCount / totalResponses) * 100)
            : 0;

        const followUpRequests = surveys?.filter(s => s.want_contact === 'yes').length || 0;
        const followUpRate = totalResponses > 0
            ? Math.round((followUpRequests / totalResponses) * 100)
            : 0;

        // Update metrics
        document.getElementById('totalResponsesMetric').textContent = totalResponses;
        document.getElementById('avgOverallMetric').textContent = avgOverall;
        document.getElementById('satisfactionRateMetric').textContent = `${satisfactionRate}%`;
        document.getElementById('responseRateMetric').textContent = `${followUpRate}%`;

        // Create all charts
        this.createAllCharts(surveys || []);
        
    } catch (error) {
        console.error('Failed to load analytics:', error);
        // Show default values on error
        document.getElementById('totalResponsesMetric').textContent = '0';
        document.getElementById('avgOverallMetric').textContent = '0.0';
        document.getElementById('satisfactionRateMetric').textContent = '0%';
        document.getElementById('responseRateMetric').textContent = '0%';
        this.createEmptyCharts();
    }
}

// Create all charts with proper data
createAllCharts(surveys) {
    // Destroy existing charts
    Object.values(this.charts).forEach(chart => chart?.destroy());
    this.charts = {};

    if (!surveys || surveys.length === 0) {
        this.createEmptyCharts();
        return;
    }

    // Create each chart
    this.createSatisfactionTrendChart(surveys);
    this.createClinicPerformanceChart(surveys);
    this.createDepartmentChart(surveys);
    this.createRatingDistributionChart(surveys);
    this.createVisitTypeChart(surveys);
    this.createServiceQualityChart(surveys);
    this.createRecommendationChart(surveys);
    this.createFollowupBySatisfactionChart(surveys);
}

createSatisfactionTrendChart(surveys) {
    const ctx = document.getElementById('satisfactionChart');
    if (!ctx) return;

    // Get last 7 days data
    const last7Days = [];
    const labels = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        
        const daySurveys = surveys.filter(s => s.created_at.split('T')[0] === dateStr);
        const avgSatisfaction = this.calculateAverageOverallSatisfaction(daySurveys);
        last7Days.push(parseFloat(avgSatisfaction));
    }

    this.charts.satisfaction = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Satisfaction',
                data: last7Days,
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3, // Thicker line
                pointRadius: 4, // Visible points
                pointBackgroundColor: '#2c5aa0',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false // Hide legend
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false // Remove vertical grid
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        borderDash: [5, 5] // Dotted horizontal grid
                    }
                }
            }
        }
    });
}


createClinicPerformanceChart(surveys) {
    const ctx = document.getElementById('clinicChart');
    if (!ctx) return;

    // Calculate average satisfaction by clinic
    const clinicData = {};
    const clinicLabels = [];
    const clinicFullNames = [];
    
    Object.keys(clinicMap).forEach((clinicId, index) => {
        if (clinicId !== 'other') {
            const clinicSurveys = surveys.filter(s => s.clinic_location === clinicId);
            if (clinicSurveys.length > 0) {
                // Use simple labels like "Clinic 1", "Clinic 2", etc.
                const label = `Clinic ${index + 1}`;
                clinicLabels.push(label);
                clinicFullNames.push(clinicMap[clinicId]);
                clinicData[label] = parseFloat(this.calculateAverageOverallSatisfaction(clinicSurveys));
            }
        }
    });

    this.charts.clinic = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: clinicLabels,
            datasets: [{
                label: 'Average Rating',
                data: Object.values(clinicData),
                backgroundColor: '#10b981',
                borderRadius: 5,
                barThickness: 60
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return clinicFullNames[index];
                        },
                        label: function(context) {
                            return `Average Rating: ${context.parsed.y.toFixed(1)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 14
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

createDepartmentChart(surveys) {
    const ctx = document.getElementById('departmentChart');
    if (!ctx) return;

    // Calculate aspect ratings with correct field mapping
    const aspectData = {
        'Reception': this.calculateAverageDetailedSatisfaction(surveys, 'reception_satisfaction'),
        'Nursing': this.calculateAverageNursingProfessionalism(surveys),
        'Doctor': this.calculateAverageDetailedSatisfaction(surveys, 'doctor_satisfaction'),
        'Cleanliness': this.calculateAverageDetailedSatisfaction(surveys, 'clinic_cleanliness')
    };

    this.charts.department = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: Object.keys(aspectData),
            datasets: [{
                label: 'Average Rating',
                data: Object.values(aspectData),
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.2)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

createRatingDistributionChart(surveys) {
    const ctx = document.getElementById('ratingChart');
    if (!ctx) return;

    // Only show the 3 options that exist in the survey
    const distribution = {
        'Dissatisfied': surveys.filter(s => s.overall_satisfaction === 'dissatisfied').length,
        'Satisfied': surveys.filter(s => s.overall_satisfaction === 'satisfied').length,
        'Very Satisfied': surveys.filter(s => s.overall_satisfaction === 'very_satisfied').length
    };

    this.charts.rating = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(distribution),
            datasets: [{
                data: Object.values(distribution),
                backgroundColor: ['#ef4444', '#3b82f6', '#10b981']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

createVisitTypeChart(surveys) {
    const ctx = document.getElementById('visitTypeChart');
    if (!ctx) return;

    const visitTypes = {
        'First Visit': surveys.filter(s => s.visit_type === 'first_visit').length,
        'Follow Up': surveys.filter(s => s.visit_type === 'follow_up').length
    };

    this.charts.visitType = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(visitTypes),
            datasets: [{
                data: Object.values(visitTypes),
                backgroundColor: ['#8b5cf6', '#06b6d4']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Service Quality Chart
createServiceQualityChart(surveys) {
    const ctx = document.getElementById('serviceQualityChart');
    if (!ctx) return;

    const metrics = {
        'Registration Smooth': this.calculateYesPercentage(surveys, 'registration_smooth'),
        'Nursing Prompt': this.calculateYesPercentage(surveys, 'nursing_prompt'),
        'Doctor Listening': this.calculateYesPercentage(surveys, 'doctor_listening'),
        'Clear Explanation': this.calculateYesPercentage(surveys, 'doctor_explanation'),
        'Acceptable Wait Time': this.calculateYesPercentage(surveys, 'waiting_time_acceptable')
    };

    this.charts.serviceQuality = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(metrics),
            datasets: [{
                label: 'Yes (%)',
                data: Object.values(metrics),
                backgroundColor: '#10b981',
                borderRadius: 5, // Add rounded corners
                barThickness: 40 // Consistent bar thickness
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false // Hide legend for cleaner look
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false // Remove grid lines
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        borderDash: [5, 5] // Dotted grid lines
                    }
                }
            }
        }
    });
}

// Recommendation Chart
createRecommendationChart(surveys) {
    const ctx = document.getElementById('recommendationChart');
    if (!ctx) return;

    const recommendations = {
        'Very Unlikely': surveys.filter(s => s.recommendation_likelihood === 'very_unlikely').length,
        'Unlikely': surveys.filter(s => s.recommendation_likelihood === 'unlikely').length,
        'Neutral': surveys.filter(s => s.recommendation_likelihood === 'neutral').length,
        'Likely': surveys.filter(s => s.recommendation_likelihood === 'likely').length,
        'Very Likely': surveys.filter(s => s.recommendation_likelihood === 'very_likely').length
    };

    this.charts.recommendation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(recommendations),
            datasets: [{
                label: 'Count',
                data: Object.values(recommendations),
                backgroundColor: ['#991b1b', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
                borderRadius: 5, // Add rounded corners
                barThickness: 40 // Consistent bar thickness
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false // Hide legend
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false // Remove grid lines
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        borderDash: [5, 5] // Dotted grid lines
                    }
                }
            }
        }
    });
}

// Follow-up by Satisfaction Chart
createFollowupBySatisfactionChart(surveys) {
    const ctx = document.getElementById('followupBySatisfactionChart');
    if (!ctx) return;

    const data = ['dissatisfied', 'satisfied', 'very_satisfied'].map(level => {
        const levelSurveys = surveys.filter(s => s.overall_satisfaction === level);
        const followupRequests = levelSurveys.filter(s => s.want_contact === 'yes').length;
        return levelSurveys.length > 0 ? Math.round((followupRequests / levelSurveys.length) * 100) : 0;
    });

    this.charts.followupBySatisfaction = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Dissatisfied', 'Satisfied', 'Very Satisfied'],
            datasets: [{
                label: 'Follow-up Request Rate (%)',
                data: data,
                backgroundColor: ['#ef4444', '#3b82f6', '#10b981'],
                borderRadius: 5, // Add rounded corners
                barThickness: 60 // Wider bars for 3 items
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false // Hide legend
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false // Remove grid lines
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        borderDash: [5, 5] // Dotted grid lines
                    }
                }
            }
        }
    });
}
    }

    // Global functions
    let dashboardInstance;

    document.addEventListener('DOMContentLoaded', () => {
        // Check if Supabase is properly configured
        if (SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL' || 
            SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
            alert('Please update Supabase configuration in the dashboard code!');
            return;
        }
        
        dashboardInstance = new AdminDashboard();
    });

    // Survey detail modal
    async function viewSurvey(surveyId) {
        try {
            const { data: survey, error } = await supabase
                .from('surveys')
                .select('*')
                .eq('id', surveyId)
                .single();

            if (error) throw error;

            const modalContent = document.getElementById('surveyDetails');
            modalContent.innerHTML = `
                <div class="survey-detail-container">
                    <div class="detail-section">
                        <h4 class="section-title">📋 Basic Information</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Patient Name</label>
                                <span>${survey.patient_name}</span>
                            </div>
                            <div class="detail-item">
                                <label>Email</label>
                                <span>${survey.patient_email}</span>
                            </div>
                            <div class="detail-item">
                                <label>Phone</label>
                                <span>${survey.patient_phone || 'Not provided'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Visit Date</label>
                                <span>${new Date(survey.visit_date).toLocaleDateString()}</span>
                            </div>
                            <div class="detail-item">
                                <label>Clinic</label>
                                <span>${clinicMap[survey.clinic_location] || survey.clinic_location}</span>
                            </div>
                            <div class="detail-item">
                                <label>Submitted At</label>
                                <span>${new Date(survey.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4 class="section-title">⭐ Overall Experience</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Overall Satisfaction</label>
                                <span>${formatSatisfaction(survey.overall_satisfaction)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Visit Type</label>
                                <span>${survey.visit_type === 'first_visit' ? 'First Visit' : 'Follow Up'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4 class="section-title">🏢 Reception Staff</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Satisfaction</label>
                                <span>${formatSatisfaction(survey.reception_satisfaction)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Registration Smooth</label>
                                <span>${formatYesNo(survey.registration_smooth)}</span>
                            </div>
                            ${survey.reception_comments ? `
                            <div class="detail-item full-width">
                                <label>Comments</label>
                                <span>${survey.reception_comments}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4 class="section-title">👩‍⚕️ Nursing Staff</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Professionalism</label>
                                <span>${formatProfessionalism(survey.nursing_professionalism)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Prompt Service</label>
                                <span>${formatYesNo(survey.nursing_prompt)}</span>
                            </div>
                            ${survey.nursing_comments ? `
                            <div class="detail-item full-width">
                                <label>Comments</label>
                                <span>${survey.nursing_comments}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4 class="section-title">👨‍⚕️ Doctor Consultation</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Satisfaction</label>
                                <span>${formatSatisfaction(survey.doctor_satisfaction)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Listened to Concerns</label>
                                <span>${formatYesNo(survey.doctor_listening)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Clear Explanation</label>
                                <span>${formatYesNo(survey.doctor_explanation)}</span>
                            </div>
                            ${survey.doctor_comments ? `
                            <div class="detail-item full-width">
                                <label>Comments</label>
                                <span>${survey.doctor_comments}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4 class="section-title">🏥 Clinic Environment</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Cleanliness</label>
                                <span>${formatSatisfaction(survey.clinic_cleanliness)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Waiting Time Acceptable</label>
                                <span>${formatYesNo(survey.waiting_time_acceptable)}</span>
                            </div>
                            ${survey.environment_comments ? `
                            <div class="detail-item full-width">
                                <label>Comments</label>
                                <span>${survey.environment_comments}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    ${survey.liked_most || survey.areas_improve ? `
                    <div class="detail-section">
                        <h4 class="section-title">📝 Additional Feedback</h4>
                        <div class="detail-grid">
                            ${survey.liked_most ? `
                            <div class="detail-item full-width">
                                <label>What they liked most</label>
                                <span>${survey.liked_most}</span>
                            </div>` : ''}
                            ${survey.areas_improve ? `
                            <div class="detail-item full-width">
                                <label>Areas to improve</label>
                                <span>${survey.areas_improve}</span>
                            </div>` : ''}
                        </div>
                    </div>` : ''}

                    <div class="detail-section">
                        <h4 class="section-title">👥 Recommendation</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Likelihood to Recommend</label>
                                <span>${formatRecommendation(survey.recommendation_likelihood)}</span>
                            </div>
                            ${survey.recommendation_comments ? `
                            <div class="detail-item full-width">
                                <label>Comments</label>
                                <span>${survey.recommendation_comments}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4 class="section-title">📞 Contact Preferences</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Want Contact</label>
                                <span>${formatYesNo(survey.want_contact)}</span>
                            </div>
                            ${survey.want_contact === 'yes' ? `
                            <div class="detail-item">
                                <label>Preferred Contact Method</label>
                                <span>${survey.contact_preference?.join(', ') || 'Any'}</span>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('surveyModal').style.display = 'block';
            
        } catch (error) {
            console.error('Error viewing survey:', error);
            alert('Error loading survey details');
        }
    }

    function closeSurveyModal() {
        document.getElementById('surveyModal').style.display = 'none';
    }

    function refreshData() {
        dashboardInstance?.refreshData();
    }

    function loadSurveysData() {
        dashboardInstance?.loadSurveysData();
    }

    function loadFollowUpsData() {
        dashboardInstance?.loadFollowUpsData();
    }

    function loadUsersData() {
        dashboardInstance?.loadUsersData();
    }

    function applyFilters() {
        dashboardInstance?.loadSurveysData();
    }

    function applyFollowUpFilters() {
        dashboardInstance?.loadFollowUpsData();
    }

    async function completeFollowUp(followUpId) {
        try {
            const { error } = await supabase
                .from('follow_ups')
                .update({ 
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', followUpId);

            if (error) throw error;
            
            dashboardInstance?.loadFollowUpsData();
            alert('Follow-up marked as completed!');
            
        } catch (error) {
            console.error('Error completing follow-up:', error);
            alert('Failed to complete follow-up');
        }
    }

    async function deactivateUser(userId) {
        if (confirm('Are you sure you want to deactivate this user? They will not be able to login.')) {
            try {
                const { error } = await supabase
                    .from('admin_users')
                    .update({ status: 'inactive' })
                    .eq('id', userId);

                if (error) throw error;
                
                dashboardInstance?.loadUsersData();
                alert('User deactivated successfully!');
                
            } catch (error) {
                console.error('Error deactivating user:', error);
                alert('Failed to deactivate user: ' + error.message);
            }
        }
    }
   
    async function activateUser(userId) {
        if (confirm('Are you sure you want to activate this user? They will be able to login again.')) {
            try {
                const { error } = await supabase
                    .from('admin_users')
                    .update({ status: 'active' })
                    .eq('id', userId);

                if (error) throw error;
                
                dashboardInstance?.loadUsersData();
                alert('User activated successfully!');
                
            } catch (error) {
                console.error('Error activating user:', error);
                alert('Failed to activate user: ' + error.message);
            }
        }
    }
   
    async function exportData(format) {
    try {
        // Show loading
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading show';
        loadingEl.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loadingEl);

        // Get filter values
        const clinicFilter = document.getElementById('clinicFilter').value;
        const dateRangeFilter = document.getElementById('dateRangeFilter').value;
        const satisfactionFilter = document.getElementById('satisfactionFilter').value;
        const searchFilter = document.getElementById('searchFilter')?.value.toLowerCase().trim() || '';

        let query = supabase.from('surveys').select('*');

        // Apply clinic filter
        if (clinicFilter) {
            query = query.eq('clinic_location', clinicFilter);
        } else if (dashboardInstance?.currentUser?.role === 'admin' && dashboardInstance?.currentUser?.assigned_clinic) {
            query = query.eq('clinic_location', dashboardInstance.currentUser.assigned_clinic);
        }

        // Apply date range filter
        const now = new Date();
        switch (dateRangeFilter) {
            case 'today':
                const today = new Date().toISOString().split('T')[0];
                query = query.gte('created_at', today + 'T00:00:00');
                break;
            case 'week':
                const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
                query = query.gte('created_at', weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
                query = query.gte('created_at', monthAgo);
                break;
        }

        // Apply satisfaction filter
        if (satisfactionFilter) {
            query = query.eq('overall_satisfaction', satisfactionFilter);
        }

        // Apply search filter
        if (searchFilter) {
            query = query.or(`patient_name.ilike.%${searchFilter}%,patient_email.ilike.%${searchFilter}%,patient_phone.ilike.%${searchFilter}%`);
        }

        // Apply sorting
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No data to export');
            document.body.removeChild(loadingEl);
            return;
        }

        if (format === 'excel') {
            exportToExcel(data);
        } else if (format === 'pdf') {
            exportToPDF(data);
        }

        // Remove loading
        document.body.removeChild(loadingEl);

    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export data: ' + error.message);
        const loadingEl = document.querySelector('.loading.show');
        if (loadingEl) document.body.removeChild(loadingEl);
    }
}

function exportToExcel(data) {
    try {
        // Prepare data for Excel
        const excelData = data.map(survey => ({
            'Survey ID': survey.id,
            'Patient Name': survey.patient_name,
            'Email': survey.patient_email,
            'Phone': survey.patient_phone || 'N/A',
            'Visit Date': new Date(survey.visit_date).toLocaleDateString(),
            'Clinic': clinicMap[survey.clinic_location] || survey.clinic_location,
            'Overall Satisfaction': formatSatisfaction(survey.overall_satisfaction),
            'Visit Type': survey.visit_type === 'first_visit' ? 'First Visit' : 'Follow Up',
            'Reception Satisfaction': formatSatisfaction(survey.reception_satisfaction),
            'Registration Smooth': formatYesNo(survey.registration_smooth),
            'Reception Comments': survey.reception_comments || '',
            'Nursing Professionalism': formatProfessionalism(survey.nursing_professionalism),
            'Nursing Prompt': formatYesNo(survey.nursing_prompt),
            'Nursing Comments': survey.nursing_comments || '',
            'Doctor Satisfaction': formatSatisfaction(survey.doctor_satisfaction),
            'Doctor Listening': formatYesNo(survey.doctor_listening),
            'Doctor Explanation': formatYesNo(survey.doctor_explanation),
            'Doctor Comments': survey.doctor_comments || '',
            'Clinic Cleanliness': formatSatisfaction(survey.clinic_cleanliness),
            'Waiting Time Acceptable': formatYesNo(survey.waiting_time_acceptable),
            'Environment Comments': survey.environment_comments || '',
            'Liked Most': survey.liked_most || '',
            'Areas to Improve': survey.areas_improve || '',
            'Recommendation Likelihood': formatRecommendation(survey.recommendation_likelihood),
            'Recommendation Comments': survey.recommendation_comments || '',
            'Want Contact': formatYesNo(survey.want_contact),
            'Contact Preference': Array.isArray(survey.contact_preference) ? survey.contact_preference.join(', ') : '',
            'Submitted At': new Date(survey.created_at).toLocaleString()
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Auto-size columns
        const colWidths = [];
        Object.keys(excelData[0]).forEach((key, i) => {
            const maxLength = Math.max(
                key.length,
                ...excelData.map(row => String(row[key] || '').length)
            );
            colWidths[i] = { wch: Math.min(maxLength + 2, 50) };
        });
        ws['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Survey Responses');

        // Generate filename with date
        const filename = `survey_responses_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Save file
        XLSX.writeFile(wb, filename);

        console.log(`Exported ${data.length} surveys to Excel`);

    } catch (error) {
        console.error('Excel export error:', error);
        alert('Failed to export to Excel: ' + error.message);
    }
}

function exportToPDF(data) {
    try {
        // Create new PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Add title
        doc.setFontSize(20);
        doc.setTextColor(44, 90, 160); // Primary color
        doc.text('Clinic Survey Report', 14, 15);

        // Add date
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139); // Text light color
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 23);
        doc.text(`Total Surveys: ${data.length}`, 14, 30);

        // Calculate statistics using the proper methods
        const stats = calculateDetailedStatistics(data);

        // Add summary statistics
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59); // Text color
        doc.text('Summary Statistics', 14, 40);

        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        doc.text(`Average Overall Satisfaction: ${stats.avgOverallSatisfaction}/5`, 14, 48);
        doc.text(`Satisfaction Rate: ${stats.satisfactionRate}%`, 14, 55);
        doc.text(`Follow-up Request Rate: ${stats.followUpRate}%`, 14, 62);

        // Add service quality metrics
        doc.text('Service Quality Metrics:', 120, 48);
        doc.text(`Registration Smooth: ${stats.registrationSmooth}%`, 120, 55);
        doc.text(`Doctor Listened: ${stats.doctorListening}%`, 120, 62);
        doc.text(`Acceptable Wait Time: ${stats.acceptableWaitTime}%`, 120, 69);

        // Add clinic breakdown
        let yPos = 75;
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Clinic Performance', 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        Object.entries(stats.clinicStats).forEach(([clinic, data]) => {
            doc.setTextColor(71, 85, 105);
            doc.text(`${clinic}: ${data.count} surveys, ${data.avgRating}/5 avg rating, ${data.satisfactionRate}% satisfaction`, 20, yPos);
            yPos += 7;
        });

        // Add detailed table on new page
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(44, 90, 160);
        doc.text('Survey Details', 14, 15);

        // Prepare table data
        const tableData = data.map(survey => [
            survey.patient_name,
            survey.patient_email,
            new Date(survey.visit_date).toLocaleDateString(),
            clinicMap[survey.clinic_location] || survey.clinic_location,
            formatSatisfaction(survey.overall_satisfaction),
            formatYesNo(survey.want_contact),
            new Date(survey.created_at).toLocaleDateString()
        ]);

        // Add table
        doc.autoTable({
            head: [['Patient Name', 'Email', 'Visit Date', 'Clinic', 'Satisfaction', 'Follow-up', 'Submitted']],
            body: tableData,
            startY: 25,
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            headStyles: {
                fillColor: [44, 90, 160],
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            }
        });

        // Add charts summary page
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(44, 90, 160);
        doc.text('Department Performance', 14, 15);

        // Add department ratings
        yPos = 30;
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('Average Department Ratings (out of 5):', 14, yPos);
        yPos += 10;

        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        doc.text(`Reception: ${stats.departmentRatings.reception}/5`, 20, yPos);
        yPos += 7;
        doc.text(`Nursing: ${stats.departmentRatings.nursing}/5`, 20, yPos);
        yPos += 7;
        doc.text(`Doctor: ${stats.departmentRatings.doctor}/5`, 20, yPos);
        yPos += 7;
        doc.text(`Cleanliness: ${stats.departmentRatings.cleanliness}/5`, 20, yPos);

        // Save PDF
        const filename = `survey_report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        console.log(`Exported ${data.length} surveys to PDF`);

    } catch (error) {
        console.error('PDF export error:', error);
        alert('Failed to export to PDF: ' + error.message);
    }
}

function calculateDetailedStatistics(data) {
    const totalSurveys = data.length;
    
    // Calculate average overall satisfaction using the correct scale
    const avgOverallSatisfaction = calculateAverageOverallSatisfaction(data);

    // Calculate satisfaction rate
    const satisfiedCount = data.filter(s => 
        s.overall_satisfaction === 'satisfied' || s.overall_satisfaction === 'very_satisfied'
    ).length;
    const satisfactionRate = totalSurveys > 0
        ? Math.round((satisfiedCount / totalSurveys) * 100)
        : 0;

    // Calculate follow-up rate
    const followUpRequests = data.filter(s => s.want_contact === 'yes').length;
    const followUpRate = totalSurveys > 0
        ? Math.round((followUpRequests / totalSurveys) * 100)
        : 0;

    // Calculate service quality metrics
    const registrationSmooth = calculateYesPercentage(data, 'registration_smooth');
    const doctorListening = calculateYesPercentage(data, 'doctor_listening');
    const acceptableWaitTime = calculateYesPercentage(data, 'waiting_time_acceptable');

    // Calculate department ratings
    const departmentRatings = {
        reception: calculateAverageDetailedSatisfaction(data, 'reception_satisfaction'),
        nursing: calculateAverageNursingProfessionalism(data),
        doctor: calculateAverageDetailedSatisfaction(data, 'doctor_satisfaction'),
        cleanliness: calculateAverageDetailedSatisfaction(data, 'clinic_cleanliness')
    };

    // Calculate clinic statistics
    const clinicStats = {};
    Object.keys(clinicMap).forEach(clinicId => {
        const clinicSurveys = data.filter(s => s.clinic_location === clinicId);
        if (clinicSurveys.length > 0) {
            const clinicName = clinicMap[clinicId];
            const clinicSatisfied = clinicSurveys.filter(s => 
                s.overall_satisfaction === 'satisfied' || s.overall_satisfaction === 'very_satisfied'
            ).length;
            
            clinicStats[clinicName] = {
                count: clinicSurveys.length,
                avgRating: calculateAverageOverallSatisfaction(clinicSurveys),
                satisfactionRate: Math.round((clinicSatisfied / clinicSurveys.length) * 100)
            };
        }
    });

    return {
        avgOverallSatisfaction,
        satisfactionRate,
        followUpRate,
        registrationSmooth,
        doctorListening,
        acceptableWaitTime,
        departmentRatings,
        clinicStats
    };
}

// Helper functions from the provided code
function calculateAverageOverallSatisfaction(surveys) {
    if (!surveys || surveys.length === 0) return '0.0';
    
    const total = surveys.reduce((sum, s) => sum + (satisfactionScales.overall[s.overall_satisfaction] || 3), 0);
    return (total / surveys.length).toFixed(1);
}

function calculateAverageDetailedSatisfaction(surveys, field) {
    if (!surveys || surveys.length === 0) return 0;
    
    const total = surveys.reduce((sum, s) => sum + (satisfactionScales.detailed[s[field]] || 3), 0);
    return parseFloat((total / surveys.length).toFixed(1));
}

function calculateAverageNursingProfessionalism(surveys) {
    if (!surveys || surveys.length === 0) return 0;
    
    const total = surveys.reduce((sum, s) => sum + (satisfactionScales.nursing[s.nursing_professionalism] || 2), 0);
    // Convert to 5-point scale for consistency
    return parseFloat(((total / surveys.length) * 5 / 4).toFixed(1));
}

function calculateYesPercentage(surveys, field) {
    if (!surveys || surveys.length === 0) return 0;
    
    const yesCount = surveys.filter(s => s[field] === 'yes').length;
    return Math.round((yesCount / surveys.length) * 100);
}// Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('surveyModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }

    // Setup auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            if (dashboardInstance) {
                dashboardInstance.showAuth();
            }
        }
    });
