import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import register_user, login_user

class AuthTests(unittest.TestCase):
    def test_register_and_login(self):
        import uuid
        uid = uuid.uuid4().hex[:6]
        username = f"test_user_{uid}"
        email = f"test_{uid}@example.com"
        password = "secret123"
        success = register_user(username, email, password)
        self.assertTrue(success)
        user = login_user(username, password)
        self.assertIsNotNone(user)
        self.assertEqual(user["username"], username)

if __name__ == "__main__":
    unittest.main()