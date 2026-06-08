from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8001
    environment: str = "development"

    database_url: str = "postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev"
    redis_url: str = "redis://:pacr_redis_password@localhost:6379"

    kafka_brokers: str = "localhost:9093"
    kafka_client_id: str = "plan-service"
    kafka_group_id: str = "plan-service-group"

    @property
    def kafka_broker_list(self) -> list[str]:
        return self.kafka_brokers.split(",")


settings = Settings()
