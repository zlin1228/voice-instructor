import logging

def setup_logger():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - [%(levelname)s] %(message)s'
    )

    logger = logging.getLogger('teach_mode')
    handler = logging.FileHandler('teach_mode.log')
    formatter = logging.Formatter('%(asctime)s - %(name)s - [%(levelname)s] %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


def get_logger():
    return logging.getLogger('teach_mode')