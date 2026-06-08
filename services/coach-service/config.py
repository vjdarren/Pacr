from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8002
    environment: str = "development"

    database_url: str = "postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev"
    redis_url: str = "redis://:pacr_redis_password@localhost:6379"

    kafka_brokers: str = "localhost:9093"
    kafka_client_id: str = "coach-service"
    kafka_group_id: str = "coach-service-group"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_max_tokens: int = 2048

    # JWT RS256 public key: either the PEM string or a file path
    jwt_public_key: str = ""
    jwt_public_key_path: str = ""

    history_ttl_seconds: int = 300   # 5 minutes
    max_history_messages: int = 10
    daily_message_limit_free: int = 20

    @property
    def kafka_broker_list(self) -> list[str]:
        return self.kafka_brokers.split(",")

    def get_jwt_public_key(self) -> str:
        if self.jwt_public_key:
            return self.jwt_public_key
        if self.jwt_public_key_path:
            with open(self.jwt_public_key_path, "r") as f:
                return f.read()
        # Local dev fallback
        import os
        fallback = os.path.join(os.path.dirname(__file__), "..", "auth-service", "secrets", "public.pem")
        with open(fallback, "r") as f:
            return f.read()


settings = Settings()
