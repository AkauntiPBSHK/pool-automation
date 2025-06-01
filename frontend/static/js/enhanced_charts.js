// static/js/enhanced_charts.js

// Configuration for common chart options
const chartConfig = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        duration: 500 // Faster animations for better performance
    },
    plugins: {
        legend: {
            position: 'top',
            labels: {
                boxWidth: 12,
                usePointStyle: true
            }
        },
        tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
                // Format values with appropriate units
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) label += ': ';
                    
                    if (context.parsed.y !== null) {
                        // Apply formatting based on parameter
                        const value = context.parsed.y;
                        const param = context.dataset.label.toLowerCase();
                        
                        if (param.includes('ph')) {
                            label += value.toFixed(2);
                        } else if (param.includes('turbidity')) {
                            label += value.toFixed(3) + ' NTU';
                        } else if (param.includes('chlorine')) {
                            label += value.toFixed(2) + ' mg/L';
                        } else if (param.includes('orp')) {
                            label += value.toFixed(0) + ' mV';
                        } else if (param.includes('temp')) {
                            label += value.toFixed(1) + ' °C';
                        } else {
                            label += value.toFixed(2);
                        }
                    }
                    return label;
                }
            }
        },
        annotation: {
            annotations: {
                // Will be populated dynamically
            }
        }
    }
};

// Create enhanced turbidity chart with annotations
function createEnhancedTurbidityChart(canvasId, data, config = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    // Destroy existing chart
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    
    // Extract values
    const timestamps = data.timestamps || [];
    const turbidity = data.turbidity || [];
    const dosingEvents = data.dosingEvents || [];
    const thresholds = data.thresholds || {
        high: 0.25,
        low: 0.12,
        target: 0.15
    };
    
    // Configure annotations
    const annotations = {
        highThreshold: {
            type: 'line',
            yMin: thresholds.high,
            yMax: thresholds.high,
            borderColor: 'rgba(255, 99, 132, 0.7)',
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
                content: 'High Threshold',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(255, 99, 132, 0.7)'
            }
        },
        lowThreshold: {
            type: 'line',
            yMin: thresholds.low,
            yMax: thresholds.low,
            borderColor: 'rgba(54, 162, 235, 0.7)',
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
                content: 'Low Threshold',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(54, 162, 235, 0.7)'
            }
        },
        targetValue: {
            type: 'line',
            yMin: thresholds.target,
            yMax: thresholds.target,
            borderColor: 'rgba(75, 192, 192, 0.7)',
            borderWidth: 1,
            borderDash: [2, 2],
            label: {
                content: 'Target',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(75, 192, 192, 0.7)'
            }
        }
    };
    
    // Add dosing event annotations
    dosingEvents.forEach((event, index) => {
        if (event.timestamp) {
            annotations[`dosing${index}`] = {
                type: 'line',
                xMin: event.timestamp,
                xMax: event.timestamp,
                borderColor: 'rgba(153, 102, 255, 0.7)',
                borderWidth: 2,
                label: {
                    content: 'Dosing',
                    enabled: index % 3 === 0, // Show labels for every 3rd event to avoid crowding
                    position: 'top',
                    backgroundColor: 'rgba(153, 102, 255, 0.7)'
                }
            };
        }
    });
    
    // Base configuration
    const turbidityChartConfig = {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: 'Turbidity',
                    data: turbidity,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2,
                    tension: 0.3
                },
                {
                    label: 'Moving Average',
                    data: data.movingAverage || [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'transparent',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2,
                    borderDash: [3, 3],
                    tension: 0.4
                }
            ]
        },
        options: {
            ...chartConfig,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: data.timeUnit || 'hour',
                        displayFormats: {
                            hour: 'MMM d, HH:mm',
                            day: 'MMM d'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Turbidity (NTU)'
                    },
                    min: Math.max(0, Math.min(...turbidity) * 0.8),
                    max: Math.max(...turbidity) * 1.2
                }
            },
            plugins: {
                ...chartConfig.plugins,
                annotation: {
                    annotations: annotations
                }
            }
        }
    };
    
    // Apply any custom configs
    const mergedConfig = mergeDeep(turbidityChartConfig, config);
    
    // Create and return the chart
    return new Chart(canvas, mergedConfig);
}

// Deep merge for configs
function mergeDeep(target, source) {
    const isObject = obj => obj && typeof obj === 'object';
    
    if (!isObject(target) || !isObject(source)) {
        return source;
    }
    
    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];
        
        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            target[key] = targetValue.concat(sourceValue);
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });
    
    return target;
}

// Helper for updating a chart with new data
function updateChartData(chart, newData) {
    if (!chart) return;
    
    // Update datasets
    Object.keys(newData).forEach(key => {
        if (key === 'labels') {
            chart.data.labels = newData.labels;
        } else if (key === 'datasets') {
            // Handle complete dataset replacement
            chart.data.datasets = newData.datasets;
        } else {
            // Update individual dataset
            const datasetIndex = parseInt(key);
            if (!isNaN(datasetIndex) && datasetIndex < chart.data.datasets.length) {
                chart.data.datasets[datasetIndex].data = newData[key];
            }
        }
    });
    
    // Update annotations if provided
    if (newData.annotations && chart.options.plugins.annotation) {
        chart.options.plugins.annotation.annotations = {
            ...chart.options.plugins.annotation.annotations,
            ...newData.annotations
        };
    }
    
    // Update scales if provided
    if (newData.scales) {
        Object.keys(newData.scales).forEach(axisKey => {
            if (chart.options.scales[axisKey]) {
                chart.options.scales[axisKey] = {
                    ...chart.options.scales[axisKey],
                    ...newData.scales[axisKey]
                };
            }
        });
    }
    
    chart.update();
}

// Create responsive gauges for dashboard
function createGauge(elementId, value, min, max, optimal = { min: min, max: max }) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Create svg element
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 50");
    svg.setAttribute("class", "gauge-svg");
    
    // Background arc
    const bgArc = document.createElementNS(svgNS, "path");
    const bgPath = describeArc(50, 50, 40, 180, 0);
    bgArc.setAttribute("d", bgPath);
    bgArc.setAttribute("fill", "none");
    bgArc.setAttribute("stroke", "#eee");
    bgArc.setAttribute("stroke-width", "8");
    svg.appendChild(bgArc);
    
    // Optimal range arc
    const optimalStartAngle = 180 - ((optimal.min - min) / (max - min) * 180);
    const optimalEndAngle = 180 - ((optimal.max - min) / (max - min) * 180);
    
    const optimalArc = document.createElementNS(svgNS, "path");
    const optimalPath = describeArc(50, 50, 40, optimalStartAngle, optimalEndAngle);
    optimalArc.setAttribute("d", optimalPath);
    optimalArc.setAttribute("fill", "none");
    optimalArc.setAttribute("stroke", "#8bc34a");
    optimalArc.setAttribute("stroke-width", "8");
    svg.appendChild(optimalArc);
    
    // Value arc
    const angle = 180 - ((value - min) / (max - min) * 180);
    
    const valueArc = document.createElementNS(svgNS, "path");
    const valuePath = describeArc(50, 50, 40, 180, angle);
    valueArc.setAttribute("d", valuePath);
    valueArc.setAttribute("fill", "none");
    valueArc.setAttribute("stroke", getValueColor(value, min, max, optimal));
    valueArc.setAttribute("stroke-width", "8");
    svg.appendChild(valueArc);
    
    // Gauge needle
    const needle = document.createElementNS(svgNS, "line");
    const needleX2 = 50 + 35 * Math.cos(angle * Math.PI / 180);
    const needleY2 = 50 + 35 * Math.sin(angle * Math.PI / 180);
    
    needle.setAttribute("x1", "50");
    needle.setAttribute("y1", "50");
    needle.setAttribute("x2", needleX2);
    needle.setAttribute("y2", needleY2);
    needle.setAttribute("stroke", "#333");
    needle.setAttribute("stroke-width", "2");
    svg.appendChild(needle);
    
    // Needle dot
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", "50");
    dot.setAttribute("cy", "50");
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#333");
    svg.appendChild(dot);
    
    // Min label
    const minText = document.createElementNS(svgNS, "text");
    minText.setAttribute("x", "10");
    minText.setAttribute("y", "50");
    minText.setAttribute("font-size", "4");
    minText.setAttribute("text-anchor", "start");
    minText.textContent = min.toString();
    svg.appendChild(minText);
    
    // Max label
    const maxText = document.createElementNS(svgNS, "text");
    maxText.setAttribute("x", "90");
    maxText.setAttribute("y", "50");
    maxText.setAttribute("font-size", "4");
    maxText.setAttribute("text-anchor", "end");
    maxText.textContent = max.toString();
    svg.appendChild(maxText);
    
    // Value label
    const valueText = document.createElementNS(svgNS, "text");
    valueText.setAttribute("x", "50");
    valueText.setAttribute("y", "40");
    valueText.setAttribute("font-size", "10");
    valueText.setAttribute("text-anchor", "middle");
    valueText.setAttribute("font-weight", "bold");
    valueText.textContent = formatValue(value, elementId);
    svg.appendChild(valueText);
    
    // Parameter label
    const paramText = document.createElementNS(svgNS, "text");
    paramText.setAttribute("x", "50");
    paramText.setAttribute("y", "47");
    paramText.setAttribute("font-size", "4");
    paramText.setAttribute("text-anchor", "middle");
    
    // Get parameter name from element ID
    let paramName = elementId.replace('Gauge', '');
    
    // Format with proper capitalization and units
    if (paramName === 'ph') {
        paramName = 'pH';
    } else if (paramName === 'orp') {
        paramName = 'ORP (mV)';
    } else if (paramName === 'freeChlorine') {
        paramName = 'Free Chlorine (mg/L)';
    } else if (paramName === 'turbidity') {
        paramName = 'Turbidity (NTU)';
    } else if (paramName === 'temp') {
        paramName = 'Temperature (°C)';
    } else {
        // Capitalize first letter of each word
        paramName = paramName.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }
    
    paramText.textContent = paramName;
    svg.appendChild(paramText);
    
    // Add to container
    container.appendChild(svg);
    
    // Add ARIA attributes for accessibility
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', `${paramName} gauge showing ${formatValue(value, elementId)}`);
}

// Helper function for SVG path generation
function describeArc(x, y, radius, startAngle, endAngle) {
    var start = polarToCartesian(x, y, radius, endAngle);
    var end = polarToCartesian(x, y, radius, startAngle);
    var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
        "M", start.x, start.y, 
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
}

// Helper for converting polar to cartesian coordinates
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

// Get color based on value and optimal range
function getValueColor(value, min, max, optimal) {
    if (value >= optimal.min && value <= optimal.max) {
        return "#4CAF50"; // Green for optimal
    } else if (value < min || value > max) {
        return "#F44336"; // Red for out of range
    } else {
        return "#FF9800"; // Orange for suboptimal but in range
    }
}

// Format value based on parameter type
function formatValue(value, elementId) {
    if (elementId.includes('ph')) {
        return value.toFixed(1);
    } else if (elementId.includes('orp')) {
        return value.toFixed(0);
    } else if (elementId.includes('turbidity')) {
        return value.toFixed(3);
    } else if (elementId.includes('Chlorine')) {
        return value.toFixed(2);
    } else if (elementId.includes('temp')) {
        return value.toFixed(1) + '°';
    } else {
        return value.toFixed(1);
    }
}

// Functions to export
window.ChartTools = {
    createEnhancedTurbidityChart,
    updateChartData,
    createGauge,
    chartConfig
};