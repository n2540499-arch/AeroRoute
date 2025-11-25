// Function to update UI
function updateUI(data) {
    document.getElementById("roadId").innerText = data.roadId;
    document.getElementById("congestion").innerText = data.congestion ? "Yes" : "No";
    document.getElementById("pollution").innerText = data.pollution + "%";
    document.getElementById("weather").innerText = data.weather;

    // Direction rules
    document.getElementById("emergencyDir").innerText = data.recommendedFor.emergency;
    document.getElementById("normalDir").innerText = data.recommendedFor.normal;
}

// Auto refresh every 2 seconds
setInterval(() => {
    fetch("/api/road-status")
        .then(res => res.json())
        .then(data => updateUI(data))
        .catch(err => console.log("Error:", err));
}, 2000);
