pub mod schema;
#[cfg(test)]
pub mod test_utils;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}