// ==================== CONFIGURATION ====================
const CONFIG = window.APP_CONFIG;
console.log(`Using API Endpoint: ${CONFIG.apiEndpoint}`);

// ==================== COGNITO SETUP ====================
const poolData = {
    UserPoolId: CONFIG.userPoolId,
    ClientId: CONFIG.clientId
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// ==================== STATE MANAGEMENT ====================
let cognitoUser = null;
let jwtToken = null;
let spendingChart = null;
let merchantsChart = null;
let currentReceiptsData = [];
let currentChartType = 'doughnut';

// ==================== DOM ELEMENTS ====================
const elements = {
    authSection: document.getElementById('auth-section'),
    appSection: document.getElementById('app-section'),
    signupView: document.getElementById('signup-view'),
    signinView: document.getElementById('signin-view'),
    confirmView: document.getElementById('confirm-view'),
    authMessage: document.getElementById('auth-message'),
    userEmail: document.getElementById('user-email'),
    userName: document.getElementById('user-name'),
    userInitials: document.getElementById('user-initials'),
    totalReceipts: document.getElementById('total-receipts'),
    totalAmount: document.getElementById('total-amount'),
    avgAmount: document.getElementById('avg-amount'),
    uniqueMerchants: document.getElementById('unique-merchants'),
    recentReceipts: document.getElementById('recent-receipts'),
    apiStatusValue: document.getElementById('api-status-value'),
    dataFreshness: document.getElementById('data-freshness'),
    storageUsed: document.getElementById('storage-used'),
    sessionStatus: document.getElementById('session-status'),
    lastUpdate: document.getElementById('last-update'),
    dataCount: document.getElementById('data-count'),
    cashPercent: document.getElementById('cash-percent'),
    cardPercent: document.getElementById('card-percent'),
    digitalPercent: document.getElementById('digital-percent'),
    cashBar: document.getElementById('cash-bar'),
    cardBar: document.getElementById('card-bar'),
    digitalBar: document.getElementById('digital-bar'),
    apiIndicator: document.getElementById('api-indicator'),
    freshnessIndicator: document.getElementById('freshness-indicator'),
    storageIndicator: document.getElementById('storage-indicator'),
    tokenIndicator: document.getElementById('token-indicator'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshSpinner: document.getElementById('refresh-spinner'),
    refreshBtnText: document.querySelector('#refresh-btn .btn-text')
};

// ==================== AUTHENTICATION FUNCTIONS ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 5000);
}

function showMessage(message, type = 'info') {
    elements.authMessage.textContent = message;
    elements.authMessage.className = `message ${type}`;
    elements.authMessage.style.display = 'block';
}

function clearMessage() {
    elements.authMessage.style.display = 'none';
}

function showSignUp() {
    elements.signupView.style.display = 'block';
    elements.signinView.style.display = 'none';
    elements.confirmView.style.display = 'none';
    clearMessage();
}

function showSignIn() {
    elements.signupView.style.display = 'none';
    elements.signinView.style.display = 'block';
    elements.confirmView.style.display = 'none';
    clearMessage();
}

function showConfirm(email) {
    elements.signupView.style.display = 'none';
    elements.signinView.style.display = 'none';
    elements.confirmView.style.display = 'block';
    document.getElementById('confirm-email').value = email || '';
    clearMessage();
}

function signUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;

    if (!email || !password || !name) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 8 characters', 'error');
        return;
    }

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: email
        }),
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'name',
            Value: name
        })
    ];

    userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
            showMessage(err.message || JSON.stringify(err), 'error');
            return;
        }
        cognitoUser = result.user;
        showMessage('Account created! Please check your email for the confirmation code.', 'success');
        showConfirm(email);
    });
}

function confirmSignUp() {
    const code = document.getElementById('confirm-code').value;
    const email = document.getElementById('confirm-email').value;

    if (!code || !email) {
        showMessage('Please enter confirmation code and email', 'error');
        return;
    }

    const userData = {
        Username: email,
        Pool: userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    
    cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
            showMessage(err.message || JSON.stringify(err), 'error');
            return;
        }
        showMessage('Account confirmed successfully! You can now sign in.', 'success');
        showSignIn();
    });
}

function signIn() {
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;

    if (!email || !password) {
        showMessage('Please enter email and password', 'error');
        return;
    }

    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: email,
        Password: password
    });

    const userData = {
        Username: email,
        Pool: userPool
    };

    cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
            jwtToken = result.getIdToken().getJwtToken();
            updateUIForAuthenticatedUser(email);
            showToast('Sign in successful!', 'success');
        },
        onFailure: (err) => {
            showMessage(err.message || 'Authentication failed', 'error');
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
            showMessage('New password required', 'info');
        }
    });
}

function signOut() {
    if (cognitoUser) {
        cognitoUser.signOut();
    }
    jwtToken = null;
    elements.authSection.style.display = 'block';
    elements.appSection.style.display = 'none';
    showSignIn();
    showToast('Signed out successfully', 'info');
}

function updateUIForAuthenticatedUser(email) {
    elements.userEmail.textContent = email;
    elements.authSection.style.display = 'none';
    elements.appSection.style.display = 'block';
    
    // Extract name from email for display
    const name = email.split('@')[0];
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    elements.userName.textContent = displayName;
    elements.userInitials.textContent = displayName.substring(0, 2).toUpperCase();
    
    // Update session status
    elements.sessionStatus.textContent = 'Active';
    elements.sessionStatus.style.color = '#38a169';
    elements.tokenIndicator.className = 'status-indicator success';
    
    // Fetch receipts on successful login
    setTimeout(() => fetchReceipts(), 1000);
}

// ==================== DATA FETCHING & ANALYTICS ====================
async function fetchReceipts() {
    if (!jwtToken) {
        showToast('Please sign in first', 'error');
        return;
    }

    showLoading(true);
    updateApiStatus('Fetching...', 'warning');

    try {
        const response = await fetch(CONFIG.apiEndpoint + '/api', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            // Token expired, sign out
            showToast('Session expired. Please sign in again.', 'error');
            setTimeout(signOut, 3000);
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        currentReceiptsData = data.items || [];
        
        // Process and display analytics
        processAnalyticsData(currentReceiptsData);
        updateApiStatus('Connected', 'success');
        updateLastUpdate();
        showToast('Data loaded successfully!', 'success');
        
    } catch (error) {
        console.error('API Error:', error);
        updateApiStatus('Error', 'error');
        showToast('API Error: ' + error.message, 'error');
        
        // Reset UI
        resetAnalyticsUI();
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    if (show) {
        elements.refreshSpinner.style.display = 'inline-block';
        elements.refreshBtnText.textContent = 'Loading...';
        elements.refreshBtn.disabled = true;
    } else {
        elements.refreshSpinner.style.display = 'none';
        elements.refreshBtnText.textContent = 'Refresh Data';
        elements.refreshBtn.disabled = false;
    }
}

function updateApiStatus(status, type) {
    elements.apiStatusValue.textContent = status;
    
    const indicator = elements.apiIndicator;
    indicator.className = 'status-indicator';
    
    if (type === 'success') {
        elements.apiStatusValue.style.color = '#38a169';
        indicator.classList.add('success');
    } else if (type === 'warning') {
        elements.apiStatusValue.style.color = '#ed8936';
        indicator.classList.add('warning');
    } else if (type === 'error') {
        elements.apiStatusValue.style.color = '#f56565';
        indicator.classList.add('error');
    }
}

function updateLastUpdate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString();
    elements.lastUpdate.textContent = `Last updated: ${dateString} ${timeString}`;
}

function processAnalyticsData(receipts) {
    if (!receipts || receipts.length === 0) {
        resetAnalyticsUI();
        return;
    }
    
    // Update summary cards
    elements.totalReceipts.textContent = receipts.length;
    elements.dataCount.textContent = `${receipts.length} receipts processed`;
    
    // Calculate total amount
    const totalAmount = receipts.reduce((sum, receipt) => {
        return sum + (parseFloat(receipt.receipt_data?.total_amount) || 0);
    }, 0);
    elements.totalAmount.textContent = `$${totalAmount.toFixed(2)}`;
    
    // Calculate average amount
    const avgAmount = receipts.length > 0 ? totalAmount / receipts.length : 0;
    elements.avgAmount.textContent = `$${avgAmount.toFixed(2)}`;
    
    // Count unique merchants
    const uniqueMerchants = new Set(
        receipts
            .map(r => r.receipt_data?.merchant_name)
            .filter(Boolean)
            .map(name => name.trim())
    );
    elements.uniqueMerchants.textContent = uniqueMerchants.size;
    
    // Calculate storage used
    const totalStorage = receipts.reduce((sum, receipt) => sum + (receipt.file_size || 0), 0);
    const storageMB = (totalStorage / (1024 * 1024)).toFixed(2);
    elements.storageUsed.textContent = `${storageMB} MB`;
    
    // Update storage indicator
    const storageIndicator = elements.storageIndicator;
    storageIndicator.className = 'status-indicator';
    if (parseFloat(storageMB) > 100) {
        storageIndicator.classList.add('error');
    } else if (parseFloat(storageMB) > 50) {
        storageIndicator.classList.add('warning');
    } else {
        storageIndicator.classList.add('success');
    }
    
    // Update payment methods
    updatePaymentMethods(receipts);
    
    // Update recent receipts
    updateRecentReceipts(receipts);
    
    // Update data freshness
    updateDataFreshness(receipts);
    
    // Update charts
    updateCharts(receipts);
}

function resetAnalyticsUI() {
    elements.totalReceipts.textContent = '0';
    elements.totalAmount.textContent = '$0';
    elements.avgAmount.textContent = '$0';
    elements.uniqueMerchants.textContent = '0';
    elements.storageUsed.textContent = '0 MB';
    elements.dataCount.textContent = '0 receipts processed';
    
    elements.cashPercent.textContent = '0%';
    elements.cardPercent.textContent = '0%';
    elements.digitalPercent.textContent = '0%';
    elements.cashBar.style.width = '0%';
    elements.cardBar.style.width = '0%';
    elements.digitalBar.style.width = '0%';
    
    elements.recentReceipts.innerHTML = `
        <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <p>No receipts loaded. Click "Refresh Data" to load receipts.</p>
        </div>
    `;
    
    elements.freshnessIndicator.className = 'status-indicator warning';
    elements.dataFreshness.textContent = 'No data';
    elements.dataFreshness.style.color = '#718096';
    
    // Destroy charts if they exist
    if (spendingChart) {
        spendingChart.destroy();
        spendingChart = null;
    }
    if (merchantsChart) {
        merchantsChart.destroy();
        merchantsChart = null;
    }
}

function updatePaymentMethods(receipts) {
    const methods = {
        cash: 0,
        card: 0,
        credit: 0,
        debit: 0,
        digital: 0,
        other: 0
    };
    
    receipts.forEach(receipt => {
        const method = (receipt.receipt_data?.payment_method || 'other').toLowerCase();
        if (method.includes('cash')) {
            methods.cash++;
        } else if (method.includes('card') || method.includes('credit') || method.includes('debit')) {
            methods.card++;
        } else if (method.includes('digital') || method.includes('online') || method.includes('mobile')) {
            methods.digital++;
        } else {
            methods.other++;
        }
    });
    
    const total = receipts.length || 1;
    
    // Update cash
    const cashPercent = Math.round((methods.cash / total) * 100);
    elements.cashPercent.textContent = `${cashPercent}%`;
    elements.cashBar.style.width = `${cashPercent}%`;
    elements.cashBar.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    
    // Update card
    const cardPercent = Math.round(((methods.card + methods.credit + methods.debit) / total) * 100);
    elements.cardPercent.textContent = `${cardPercent}%`;
    elements.cardBar.style.width = `${cardPercent}%`;
    elements.cardBar.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    
    // Update digital
    const digitalPercent = Math.round((methods.digital / total) * 100);
    elements.digitalPercent.textContent = `${digitalPercent}%`;
    elements.digitalBar.style.width = `${digitalPercent}%`;
    elements.digitalBar.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
}

function updateRecentReceipts(receipts) {
    const container = elements.recentReceipts;
    container.innerHTML = '';
    
    if (receipts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <p>No receipts loaded</p>
            </div>
        `;
        return;
    }
    
    // Show latest 5 receipts
    const recent = receipts.slice(0, 5);
    
    recent.forEach(receipt => {
        const div = document.createElement('div');
        div.className = 'receipt-item-compact';
        
        const date = receipt.receipt_data?.date || receipt.processed_at?.split('T')[0] || 'Unknown date';
        const amount = parseFloat(receipt.receipt_data?.total_amount) || 0;
        const merchant = receipt.receipt_data?.merchant_name || 'Unknown Merchant';
        const method = receipt.receipt_data?.payment_method || 'N/A';
        const currency = receipt.receipt_data?.currency || 'USD';
        
        div.innerHTML = `
            <div class="receipt-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            </div>
            <div class="receipt-details">
                <h4>${merchant}</h4>
                <div class="receipt-meta">
                    <span>${date}</span>
                    <span>${method}</span>
                </div>
            </div>
            <div class="receipt-amount">${currency} $${amount.toFixed(2)}</div>
        `;
        
        container.appendChild(div);
    });
}

function updateDataFreshness(receipts) {
    if (receipts.length === 0) {
        elements.dataFreshness.textContent = 'No data';
        elements.freshnessIndicator.className = 'status-indicator warning';
        elements.dataFreshness.style.color = '#718096';
        return;
    }
    
    // Find latest receipt
    const latest = new Date(receipts[0].processed_at || receipts[0].processing_timestamp);
    const now = new Date();
    const diffHours = Math.floor((now - latest) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((now - latest) / (1000 * 60));
    
    // Update freshness indicator
    const indicator = elements.freshnessIndicator;
    indicator.className = 'status-indicator';
    
    if (diffHours === 0 && diffMinutes <= 30) {
        elements.dataFreshness.textContent = 'Just now';
        elements.dataFreshness.style.color = '#38a169';
        indicator.classList.add('success');
    } else if (diffHours === 0) {
        elements.dataFreshness.textContent = `${diffMinutes} min ago`;
        elements.dataFreshness.style.color = '#38a169';
        indicator.classList.add('success');
    } else if (diffHours === 1) {
        elements.dataFreshness.textContent = '1 hour ago';
        elements.dataFreshness.style.color = '#ed8936';
        indicator.classList.add('warning');
    } else if (diffHours <= 24) {
        elements.dataFreshness.textContent = `${diffHours} hours ago`;
        elements.dataFreshness.style.color = '#ed8936';
        indicator.classList.add('warning');
    } else {
        elements.dataFreshness.textContent = `${Math.floor(diffHours / 24)} days ago`;
        elements.dataFreshness.style.color = '#f56565';
        indicator.classList.add('error');
    }
}

function updateCharts(receipts) {
    // Destroy existing charts
    if (spendingChart) spendingChart.destroy();
    if (merchantsChart) merchantsChart.destroy();
    
    // Prepare data for spending chart
    const monthlyData = {};
    receipts.forEach(receipt => {
        if (receipt.receipt_data?.date) {
            const date = new Date(receipt.receipt_data.date);
            const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const amount = parseFloat(receipt.receipt_data.total_amount) || 0;
            monthlyData[monthYear] = (monthlyData[monthYear] || 0) + amount;
        }
    });
    
    // Sort by date
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA - dateB;
    });
    
    // Take last 6 months by default
    const selectedRange = document.getElementById('time-range').value;
    let displayMonths = sortedMonths;
    if (selectedRange !== 'all') {
        const monthsToShow = parseInt(selectedRange);
        displayMonths = sortedMonths.slice(-monthsToShow);
    }
    
    // Prepare data for merchants chart
    const merchantData = {};
    receipts.forEach(receipt => {
        const merchant = receipt.receipt_data?.merchant_name || 'Unknown';
        const amount = parseFloat(receipt.receipt_data?.total_amount) || 0;
        merchantData[merchant] = (merchantData[merchant] || 0) + amount;
    });
    
    // Sort merchants by total amount and take top 5
    const sortedMerchants = Object.entries(merchantData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    // Create spending chart
    const spendingCtx = document.getElementById('spendingChart').getContext('2d');
    spendingChart = new Chart(spendingCtx, {
        type: 'line',
        data: {
            labels: displayMonths,
            datasets: [{
                label: 'Spending',
                data: displayMonths.map(month => monthlyData[month]),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#764ba2',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            }
        }
    });
    
    // Create merchants chart
    const merchantsCtx = document.getElementById('merchantsChart').getContext('2d');
    merchantsChart = new Chart(merchantsCtx, {
        type: currentChartType,
        data: {
            labels: sortedMerchants.map(m => m[0]),
            datasets: [{
                data: sortedMerchants.map(m => m[1]),
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(240, 147, 251, 0.8)',
                    'rgba(79, 172, 254, 0.8)',
                    'rgba(67, 233, 123, 0.8)',
                    'rgba(250, 112, 154, 0.8)'
                ],
                borderColor: [
                    'rgba(102, 126, 234, 1)',
                    'rgba(240, 147, 251, 1)',
                    'rgba(79, 172, 254, 1)',
                    'rgba(67, 233, 123, 1)',
                    'rgba(250, 112, 154, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: currentChartType === 'doughnut' ? 'right' : 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12
                        },
                        color: '#4a5568'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: currentChartType === 'doughnut' ? '65%' : '0%'
        }
    });
}

// ==================== CHART CONTROLS ====================
function updateTimeRange() {
    if (currentReceiptsData.length > 0) {
        updateCharts(currentReceiptsData);
    }
}

function toggleChartView() {
    currentChartType = currentChartType === 'doughnut' ? 'pie' : 'doughnut';
    if (currentReceiptsData.length > 0) {
        updateCharts(currentReceiptsData);
    }
}

function showAllReceipts() {
    if (currentReceiptsData.length === 0) {
        showToast('No receipts to display', 'info');
        return;
    }
    
    // In a real app, this would open a modal or navigate to a detailed view
    showToast(`Showing all ${currentReceiptsData.length} receipts`, 'info');
    
    // For now, just show a message
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>All Receipts (${currentReceiptsData.length})</h3>
            <div class="modal-body">
                <pre>${JSON.stringify(currentReceiptsData, null, 2)}</pre>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="btn btn-primary">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        .modal-content {
            background: white;
            padding: 24px;
            border-radius: 16px;
            max-width: 800px;
            max-height: 80vh;
            overflow: auto;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .modal-body {
            margin: 20px 0;
            max-height: 60vh;
            overflow: auto;
        }
        .modal-body pre {
            background: #f8fafc;
            padding: 16px;
            border-radius: 8px;
            font-size: 12px;
        }
    `;
    document.head.appendChild(style);
}

function exportData() {
    if (currentReceiptsData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }
    
    // Convert to CSV
    const headers = ['Date', 'Merchant', 'Amount', 'Currency', 'Payment Method', 'Email From'];
    const csvRows = [
        headers.join(','),
        ...currentReceiptsData.map(receipt => [
            receipt.receipt_data?.date || '',
            `"${(receipt.receipt_data?.merchant_name || '').replace(/"/g, '""')}"`,
            receipt.receipt_data?.total_amount || 0,
            receipt.receipt_data?.currency || '',
            receipt.receipt_data?.payment_method || '',
            receipt.email_from || ''
        ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `receipts_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${currentReceiptsData.length} receipts as CSV`, 'success');
}

// ==================== AUTO-CHECK AUTH ON LOAD ====================
window.onload = function() {
    // Check if user is already authenticated
    const cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser) {
        cognitoUser.getSession((err, session) => {
            if (err || !session.isValid()) {
                return; // Session is invalid
            }
            
            jwtToken = session.getIdToken().getJwtToken();
            
            cognitoUser.getUserAttributes((err, attributes) => {
                if (err) return;
                
                const emailAttr = attributes.find(attr => attr.Name === 'email');
                const nameAttr = attributes.find(attr => attr.Name === 'name');
                
                const email = emailAttr ? emailAttr.Value : 'User';
                const name = nameAttr ? nameAttr.Value : email.split('@')[0];
                
                updateUIForAuthenticatedUser(email);
                
                // Update user name if available
                if (nameAttr) {
                    elements.userName.textContent = name;
                    elements.userInitials.textContent = name.substring(0, 2).toUpperCase();
                }
            });
        });
    }
    
    // Initialize API status
    updateApiStatus('Disconnected', 'error');
    elements.freshnessIndicator.className = 'status-indicator warning';
    elements.storageIndicator.className = 'status-indicator warning';
    elements.tokenIndicator.className = 'status-indicator success';
    elements.sessionStatus.textContent = 'Inactive';
    elements.sessionStatus.style.color = '#718096';
};