class DomainError(Exception):
    """Base class for domain-level failures raised by the service layer."""


class NotFoundError(DomainError):
    """A requested entity does not exist."""


class ValidationError(DomainError):
    """Input violated a domain rule."""
