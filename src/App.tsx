import "./App.css";

type ServiceStatus = "operational" | "degraded" | "outage";

interface Service {
  name: string;
  description: string;
  status: ServiceStatus;
  uptime: number;
}

const services: Service[] = [
  {
    name: "Website",
    description: "Main website",
    status: "operational",
    uptime: 99.99,
  },
  {
    name: "API",
    description: "Public API",
    status: "operational",
    uptime: 99.98,
  },
  {
    name: "Database",
    description: "Primary database",
    status: "operational",
    uptime: 100,
  },
  {
    name: "Authentication",
    description: "User authentication",
    status: "operational",
    uptime: 99.97,
  },
];

function getStatusLabel(status: ServiceStatus) {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "outage":
      return "Outage";
  }
}

function getOverallStatus(): ServiceStatus {
  if (services.some((service) => service.status === "outage")) {
    return "outage";
  }

  if (services.some((service) => service.status === "degraded")) {
    return "degraded";
  }

  return "operational";
}

function App() {
  const overallStatus = getOverallStatus();

  return (
    <div className="app">
      <header className="header">
        <div className="container header-content">
          <a className="logo" href="/">
            Status
          </a>

          <nav className="nav">
            <a href="#services">Services</a>
            <a href="#incidents">Incidents</a>
          </nav>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div className={`status-indicator ${overallStatus}`} />

          <div>
            <h1>
              {overallStatus === "operational"
                ? "All systems operational"
                : "Some systems are experiencing issues"}
            </h1>

            <p>
              Current status of our services and infrastructure.
            </p>
          </div>
        </section>

        <section id="services" className="section">
          <div className="section-header">
            <div>
              <h2>Services</h2>
              <p>Current status of all monitored services.</p>
            </div>
          </div>

          <div className="services">
            {services.map((service) => (
              <div className="service" key={service.name}>
                <div className="service-info">
                  <div className={`service-dot ${service.status}`} />

                  <div>
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                  </div>
                </div>

                <div className="service-status">
                  <span className={`status-text ${service.status}`}>
                    {getStatusLabel(service.status)}
                  </span>

                  <span className="uptime">
                    {service.uptime.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-header">
            <div>
              <h2>Uptime</h2>
              <p>Service availability over the last 30 days.</p>
            </div>
          </div>

          <div className="uptime-card">
            {services.map((service) => (
              <div className="uptime-row" key={service.name}>
                <div className="uptime-name">
                  <span>{service.name}</span>
                  <strong>{service.uptime.toFixed(2)}%</strong>
                </div>

                <div className="uptime-bars">
                  {Array.from({ length: 30 }).map((_, index) => (
                    <span
                      className={`uptime-bar ${service.status}`}
                      key={index}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="incidents" className="section">
          <div className="section-header">
            <div>
              <h2>Recent incidents</h2>
              <p>Past incidents and maintenance.</p>
            </div>
          </div>

          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h3>No recent incidents</h3>
            <p>
              There have been no incidents in the last 90 days.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-content">
          <span>System Status</span>
          <span>Updated just now</span>
        </div>
      </footer>
    </div>
  );
}

export default App;