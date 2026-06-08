from pydantic import BaseModel, Field


class MessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    reply: str
    remaining_messages: int


class HistoryItem(BaseModel):
    role: str
    content: str


class HistoryResponse(BaseModel):
    messages: list[HistoryItem]
